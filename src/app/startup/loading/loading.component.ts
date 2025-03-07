import { Component, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { Log } from 'ng2-logger';
import { Store } from '@ngxs/store';
import { Subject, merge } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { MotdService, MessageQuote } from 'app/core/services/motd.service';

import { environment } from 'environments/environment';
import { termsObj } from 'app/startup/terms/terms-txt';

@Component({
  encapsulation: ViewEncapsulation.None,
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit, OnDestroy {

  public readonly clientVersion: string = environment.version;

  loadingMessage: string = '';
  hasError: boolean = false;
  motd: MessageQuote = {author: '', text: ''};

  private unsubscribe$: Subject<void> = new Subject();
  private log: any = Log.create('loading.component');

  constructor(
    private _store: Store,
    private _router: Router,
    private _motdService: MotdService,
  ) {
    this.log.i('loading component initialized');
  }

  ngOnInit() {

    merge(
      this._store.select(state => state.global.loadingMessage).pipe(
        tap((msg: string) => {
          this.hasError = msg.startsWith('ERROR:');

          if (!this.hasError) {
            this.loadingMessage = msg.replace('ERROR:', '');
            return;
          }
          this.loadingMessage = msg;
        }),
        takeUntil(this.unsubscribe$),
      ),

      this._motdService.motd.pipe(
        tap((motd) => this.motd = motd),
        takeUntil(this.unsubscribe$)
      )
    ).subscribe();

    this._store.select(state => state.global.isConnected).pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(
      (isConnected: boolean) => {
        if (!isConnected) {
          return;
        }
        this.getNextRoute();
      }
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private getNextRoute() {
    const termsVersion = JSON.parse(localStorage.getItem('terms'));
    if (!termsVersion ||
        ((termsVersion.createdAt !== termsObj.createdAt) || (termsVersion.text !== termsObj.text))
    ) {
      this.goToTerms();
      return;
    }

    this._router.navigate(['/main/extra/welcome']);
  }

  private goToTerms() {
    this.log.d('Going to terms');
    this._router.navigate(['loading', 'terms']);
  }
}
