import { PartoshiAmount } from './../../../core/util/utils';
import { Injectable } from '@angular/core';
import { Log } from 'ng2-logger';
import { Observable, of, forkJoin } from 'rxjs';
import { retryWhen, catchError, map, mapTo } from 'rxjs/operators';

import { MainRpcService } from '../main-rpc/main-rpc.service';
import { RpcGetWalletInfo, RpcGetColdStakingInfo, PublicUTXO, BlindUTXO, AnonUTXO, RpcGetLockedBalances } from 'app/main/store/main.models';
import { genericPollingRetryStrategy } from 'app/core/util/utils';


interface IWalletModel {
  name: string;
}

interface IWalletCollectionModel {
  wallets: IWalletModel[];
}


@Injectable()
export class WalletInfoService {

  private log: any = Log.create('wallet-info-service.service id:' + Math.floor((Math.random() * 1000) + 1));

  private MIN_ANON_UTXO_AMOUNT: number = 1e-08;

  constructor(
    private _rpc: MainRpcService
  ) {
    this.log.d('starting service...');
  }


  getWalletInfo(retryAttempts: number = 3): Observable<RpcGetWalletInfo> {
    return this._rpc.call('getwalletinfo').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: retryAttempts})),
      catchError(error => of({}))
    );
  }


  lockWallet(retryAttempts: number = 3): Observable<boolean> {
    return this._rpc.call('walletlock').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: retryAttempts})),
      catchError(error => of(false)),
      map((result) => {
        if (typeof result === 'boolean') {
          return result;
        }
        return true;
      })
    );
  }


  encryptWallet(password: string): Observable<any> {
    return this._rpc.call('encryptwallet', [password]);
  }


  walletPassphrase(wallet: string | null, password: string, timeout: number, staking: boolean = false): Observable<any> {
    return this._rpc.call('walletpassphrase', [password, (staking ? 0 : timeout), staking], wallet);
  }


  getColdStakingInfo(retryAttempts: number = 3): Observable<RpcGetColdStakingInfo> {
    return this._rpc.call('getcoldstakinginfo').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: retryAttempts})),
      catchError(error => of({}))
    );
  }


  getWalletList(): Observable<IWalletCollectionModel> {
    return this._rpc.call('listwalletdir').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: 2}))
    );
  }


  getAllUTXOs(): Observable<{public: PublicUTXO[], blind: BlindUTXO[], anon: AnonUTXO[]}> {
    const public$: Observable<PublicUTXO[]> = this._rpc.call('listunspent').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: 1})),
      catchError(() => of([]))
    );
    const blind$: Observable<BlindUTXO[]> = this._rpc.call('listunspentblind').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: 1})),
      catchError(() => of([]))
    );
    const anon$: Observable<AnonUTXO[]> = this._rpc.call('listunspentanon').pipe(
      retryWhen (genericPollingRetryStrategy({maxRetryAttempts: 1})),
      catchError(() => of([])),
      map((utxos: AnonUTXO[]) => utxos.filter(utxo =>
        utxo && (Object.prototype.toString.call(utxo) === '[object Object]') && (+utxo.amount > this.MIN_ANON_UTXO_AMOUNT)
      ))
    );

    return forkJoin(
      {
        public: public$,
        blind: blind$,
        anon: anon$
      }
    );
  }


  getLockedBalance(): Observable<{public: number, blind: number, anon: number}> {
    return this._rpc.call('getlockedbalances').pipe(
      map((res: RpcGetLockedBalances) => {
        const resp = {
          public: 0,
          blind: 0,
          anon: 0,
        };
        if (res && (Object.prototype.toString.call(res) === '[object Object]')) {
          resp.public = new PartoshiAmount(+res.trusted_plain, false).add(new PartoshiAmount(+res.untrusted_plain)).particls();
          resp.blind = new PartoshiAmount(+res.trusted_blind, false).add(new PartoshiAmount(+res.untrusted_blind)).particls();
          resp.anon = new PartoshiAmount(+res.trusted_anon, false).add(new PartoshiAmount(+res.untrusted_anon)).particls();
        }
        return resp;
      }),
      catchError(() => of({public: 0, blind: 0, anon: 0}))
    );
  }


  setSmsgActiveWallet(name: string): Observable<boolean> {
    const params = [];
    if (typeof name === 'string') {
      params.push(name);
    }
    return this._rpc.call('smsgsetwallet', params).pipe(
      mapTo(true),
      catchError(() => of(false))
    );
  }

}
