import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material';
import { Log } from 'ng2-logger';
import { Store } from '@ngxs/store';
import { Subject, merge, defer, iif } from 'rxjs';
import { takeUntil, tap, startWith, concatMap, take, finalize } from 'rxjs/operators';
import { SendService } from './send.service';
import { targetTypeValidator, amountRangeValidator, ValidAddressValidator, publicAddressUsageValidator } from './send.validators';
import { AddressLookupModalComponent } from './addresss-lookup-modal/address-lookup-modal.component';
import { WalletEncryptionService } from 'app/main/services/wallet-encryption/wallet-encryption.service';
import { SnackbarService } from 'app/main/services/snackbar/snackbar.service';
import { SendConfirmationModalComponent } from './send-confirmation-modal/send-confirmation-modal.component';
import { CoreErrorModel } from 'app/core/core.models';
import {
  TabType,
  TxTypeOption,
  TabModel,
  SavedAddress,
  MAX_RING_SIZE,
  DEFAULT_RING_SIZE,
  MIN_RING_SIZE,
  SendTransaction,
  SendTypeToEstimateResponse
} from './send.models';
import { WalletDetailActions } from 'app/main/store/main.actions';


enum TextContent {
  LOW_BALANCE_HELP = 'It is normal to have a very small balance in Blind even after transferring out everything. This is due to the way CT works and part of the privacy platform.',
  ESTIMATE_ERROR = 'Could not accurately estimate this transaction fee. Please try again',
  SEND_SUCCESS = 'Successfully sent ${amount} PART to ${address}',
  SEND_FAILURE = 'Failed creating the transaction, please try again later',
  TRANSFER_SUCCESS = 'Successfully transferred ${amount} PART',
  PAY_FEE_ERROR = 'The transaction amount is too small to pay the fee',
  STEALTH_ADDRESS_ERROR = 'Stealth address required for private transactions!'
}


@Component({
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.scss'],
  providers: [ SendService, ValidAddressValidator ]
})
export class SendComponent implements OnInit, OnDestroy {

  showAdvanced: boolean = false;
  selectedTab: FormControl = new FormControl(0);
  sourceType: FormControl = new FormControl('part');
  targetForm: FormGroup;

  readonly minRingSize: number = MIN_RING_SIZE;
  readonly maxRingSize: number = MAX_RING_SIZE;

  readonly tabs: TabModel[] = [
    { icon: 'part-send', type: 'send', title: 'Send payment'},
    { icon: 'part-transfer', type: 'transfer', title: 'Convert Public & Private'},
  ];

  readonly selectorOptions: TxTypeOption[] = [
    { name: 'Public', balance: 0, displayedBalance: '0', value: 'part', help: '', description: 'Used for publishing of Listings and governance voting (on Listings and Proposals)' },
    { name: 'Blind', balance: 0, displayedBalance: '0', value: 'blind', help: '', description: 'Offers medium privacy, hides transaction amounts' },
    { name: 'Anon', balance: 0, displayedBalance: '0', value: 'anon', help: '', description: 'Used for spending on the Open Marketplace – offers highest privacy' }
  ];

  private destroy$: Subject<void> = new Subject();
  private log: any = Log.create('send.component');
  private isProcessing: boolean = true;


  constructor(
    private route: ActivatedRoute,
    private _sendService: SendService,
    private _unlocker: WalletEncryptionService,
    private _snackbar: SnackbarService,
    private _addressValidator: ValidAddressValidator,
    private _dialog: MatDialog,
    private _store: Store
  ) { }


  ngOnInit() {
    this.targetForm = new FormGroup({
      ringSize: new FormControl(DEFAULT_RING_SIZE, [Validators.min(this.minRingSize), Validators.max(this.maxRingSize)]),
      targetType: new FormControl('blind', targetTypeValidator(this.currentTabType, this.sourceType.value)),
      address: new FormControl('',
        publicAddressUsageValidator(this.currentTabType, this.sourceType.value),
        this._addressValidator.validate.bind(this._addressValidator)
      ),
      addressLabel: new FormControl(''),
      narration: new FormControl('', [Validators.maxLength(24)]),
      amount: new FormControl({value: '', disabled: false}, amountRangeValidator(this.selectedSourceSelector().balance)),
      isSendAll: new FormControl(false)
    });

    // Use query params to set initial values if an appropriate queryParam has been provided
    const paramsMap = this.route.snapshot.queryParamMap;
    const amountParam = +paramsMap.get('amount') || 0;
    const convert = paramsMap.get('convertTarget');
    let tab = (paramsMap.get('tab') || '') as TabType;

    this.amount.setValue(amountParam || '');

    if (convert) {
      tab = 'transfer';
      this.targetType.setValue(convert);
    }

    if (tab) {
      const  tabIdx = this.tabs.findIndex((t) => t.type === tab);
      if (tabIdx > -1) {
        this.selectedTab.setValue(tabIdx);
      }
    }

    // Event handling:

    const amount$ = defer(() => {
      const bal = this.selectedSourceSelector().balance;
      if (this.sendingAll.value) {
        this.amount.setValue(bal);
      }
      this.amount.setValidators(amountRangeValidator(bal));
      this.amount.updateValueAndValidity();
    });

    const sourceType$ = this.sourceType.valueChanges.pipe(
      tap((newValue) => {
        if (newValue === this.targetType.value) {
          this.targetType.setValue(this.selectorOptions.find(opt => opt.value !== newValue).value);
        }
        this.targetType.setValidators(targetTypeValidator(this.currentTabType, this.sourceType.value));
        this.targetType.updateValueAndValidity();
      }),
      takeUntil(this.destroy$)
    );

    const balances$ = this._sendService.getBalances().pipe(
      tap((result) => {
        this.selectorOptions.forEach(o => {
          o.balance = typeof result[o.value] === 'number' ? result[o.value] : o.balance;
          o.displayedBalance = `${o.balance}`;
          if (o.value === 'blind') {
            if ((o.balance > 0) && (o.balance < 0.0001)) {
              o.help = TextContent.LOW_BALANCE_HELP;
            } else if (o.help.length > 0) {
              o.help = '';
            }
          }
        });
      }),
      startWith({part: 0, blind: 0, anon: 0}),
      takeUntil(this.destroy$)
    );

    const amountValid$ = merge(
      sourceType$,
      balances$
    ).pipe(
      concatMap(() => amount$),
      takeUntil(this.destroy$)
    );

    const address$ = defer(() => {
      this.address.setValidators(publicAddressUsageValidator(this.currentTabType, this.sourceType.value));
      this.address.updateValueAndValidity();
    });

    const switcher$ = this.selectedTab.valueChanges.pipe(
      tap(() => {
        this.currentTabType === 'send' ? this.address.enable() : this.address.disable();
      }),
      takeUntil(this.destroy$)
    );

    const addressValid$ = merge(
      sourceType$,
      switcher$
    ).pipe(
      concatMap(() => address$),
      takeUntil(this.destroy$)
    );

    const sendingAll$ = this.sendingAll.valueChanges.pipe(
      tap((newValue: boolean) => {
        if (newValue) {
          this.amount.disable();
          this.amount.setValue(this.selectedSourceSelector().balance);
        } else if (this.amount.disabled) {
          this.amount.enable();
        }
      }),
      takeUntil(this.destroy$)
    );

    merge(
      amountValid$,
      addressValid$,
      sendingAll$
    ).subscribe();

    this.isProcessing = false;
  }


  get ringSize(): AbstractControl {
    return this.targetForm.get('ringSize');
  }

  get targetType(): AbstractControl {
    return this.targetForm.get('targetType');
  }

  get address(): AbstractControl {
    return this.targetForm.get('address');
  }

  get addressLabel(): AbstractControl {
    return this.targetForm.get('addressLabel');
  }

  get narration(): AbstractControl {
    return this.targetForm.get('narration');
  }

  get amount(): AbstractControl {
    return this.targetForm.get('amount');
  }

  get sendingAll(): AbstractControl {
    return this.targetForm.get('isSendAll');
  }

  get currentTabType(): TabType {
    return this.tabs[this.selectedTab.value].type;
  }


  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  openAddressLookup(): void {
    const dialog = this._dialog.open(AddressLookupModalComponent);
    dialog.componentInstance.addressSelected.pipe(take(1)).subscribe(
      (value: SavedAddress) => {
        if (value && value.address) {
          this.address.setValue(value.address);
        }
        if (value && value.label) {
          this.addressLabel.setValue(value.label);
        }
      }
    );
    dialog.afterClosed().pipe(take(1)).subscribe(() => dialog.componentInstance.addressSelected.unsubscribe());
  }


  clearSendInputs(): void {
    this.address.setValue('');
    this.addressLabel.setValue('');
  }


  onSubmit() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    const trans = new SendTransaction();
    trans.transactionType = this.currentTabType;
    trans.source = this.sourceType.value;
    trans.targetAddress = this.address.value;
    trans.targetTransfer = this.targetType.value;
    trans.amount = +this.amount.value;
    trans.narration = this.narration.value || '';
    trans.ringSize = this.ringSize.value;
    trans.deductFeesFromTotal = this.sendingAll.value;
    trans.addressLabel = trans.transactionType === 'send' ? this.addressLabel.value : '';

    this._unlocker.unlock({timeout: 10}).pipe(
      finalize(() => this.isProcessing = false),
      concatMap((unlocked: boolean) => iif(() => unlocked, this._sendService.runTransaction(trans, true)))
    ).subscribe(
      (result: SendTypeToEstimateResponse) => {
        const dialog = this._dialog.open(SendConfirmationModalComponent, {data: {sendTx: trans, fee: result.fee}});
        dialog.componentInstance.isConfirmed.pipe(
          take(1),
          concatMap(() => this._unlocker.unlock({timeout: 5}).pipe(
            concatMap((unlocked) => iif(() => unlocked, this._sendService.runTransaction(trans, false)))
          ))
        ).subscribe(
          () => {
            // request new balances
            this._store.dispatch(new WalletDetailActions.GetAllUTXOS());

            // present success message
            const trimAddress = trans.targetAddress.substring(0, 16) + '...';
            const displayAmount = this.amount.value;
            const text = this.selectedTab.value === 'send' ?
              TextContent.SEND_SUCCESS.replace('${amount}', displayAmount).replace('${address}', trimAddress) :
              TextContent.TRANSFER_SUCCESS.replace('${amount}', displayAmount);

            // reset relevant input fields
            this.amount.reset();
            this.address.reset();
            this.addressLabel.reset();
            this.narration.reset();
            this.sendingAll.reset();

            this._snackbar.open(text, '');
          },
          (err) => {
            this.log.er('sending failed: ', err);
            this._snackbar.open(TextContent.SEND_FAILURE);
          }
        );
        dialog.afterClosed().pipe(take(1)).subscribe(() => dialog.componentInstance.isConfirmed.unsubscribe());
      },

      (err: CoreErrorModel) => {
        this.log.er('estimation failed: ', err);
        const errorMessage = err.message || '';
        let text: string;

        switch (true) {
          case errorMessage.includes('amount is too small to pay the fee'):
            text = TextContent.PAY_FEE_ERROR;
            break;
          default:
            text = TextContent.ESTIMATE_ERROR;
        }
        this._snackbar.open(text, 'err');
      }
    );
  }


  private selectedSourceSelector(): TxTypeOption {
    return this.selectorOptions.find(opt => opt.value === this.sourceType.value);
  }
}
