import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from 'ng2-logger';

import { ObservableFactoryFunction, Receiver, ListenerEvent } from './ipc.types';


@Injectable(
  {providedIn: 'root'}
)
export class IpcService {

  listeners: { [id: string]: boolean } = {};

  /* Listeners on the renderer */
  private listenerCount: number = 0;

  constructor(public zone: NgZone) {

    // if not electron, quit
    if (!window.electron) {
      return;
    }

    // Respond to checks if a listener is registered
    window.electron.ipc.on('rx-ipc-check-listener', (event, channel) => {
      const replyChannel = 'rx-ipc-check-reply:' + channel;
      if (this.listeners[channel]) {
        event.sender.send(replyChannel, true);
      } else {
        event.sender.send(replyChannel, false);
      }
    });
  }

  checkRemoteListener(channel: string, receiver: Receiver) {
    const target = receiver == null ? window.electron.ipc : receiver;
    return new Promise((resolve, reject) => {
      window.electron.ipc.once('rx-ipc-check-reply:' + channel, (event, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(false);
        }
      });
      target.send('rx-ipc-check-listener', channel);
    });
  }

  public cleanUp() {
    window.electron.ipc.removeAllListeners('rx-ipc-check-listener');
    Object.keys(this.listeners).forEach((channel) => {
      this.removeListeners(channel);
    });
  }

  registerListener(channel: string, observableFactory: ObservableFactoryFunction) {
    this.listeners[channel] = true;
    window.electron.ipc.on(channel, function openChannel(event: ListenerEvent, subChannel: string, ...args: any[]) {
        // Save the listener function so it can be removed
        const replyTo = event.sender;
        const observable = observableFactory(...args);
        observable.subscribe(
          (data) => {
            replyTo.send(subChannel, 'n', data);
          },
          (err) => {
            replyTo.send(subChannel, 'e', err);
          },
          () => {
            replyTo.send(subChannel, 'c');
          }
        );
    });
  }

  removeListeners(channel: string) {
    window.electron.ipc.removeAllListeners(channel);
    delete this.listeners[channel];
  }

  runCommand(channel: string, receiver: Receiver = null, ...args: any[]): Observable<any> {
    const self = this;
    const subChannel = channel + ':' + this.listenerCount;
    this.listenerCount++;
    const target = receiver == null ? window.electron.ipc : receiver;

    target.send(channel, subChannel, ...args);
    return new Observable((observer) => {
      this.checkRemoteListener(channel, receiver)
        .catch(() => {
          // observer.error('Invalid channel: ' + channel);
        });
      window.electron.ipc.on(subChannel, function listener(event: Event, type: string, data: Object) {
        self.zone.run(() => {
          switch (type) {
            case 'n':
              observer.next(data);
              break;
            case 'e':
              observer.error((<any>data).error ? (<any>data).error : data);
              break;
            case 'c':
              observer.complete();
          }
          // Cleanup
          return () => {
            // TODO: Why is this not being called & when should it be?
            window.electron.ipc.removeListener(subChannel, listener);
          };
        });
      });
    });
  }

}
