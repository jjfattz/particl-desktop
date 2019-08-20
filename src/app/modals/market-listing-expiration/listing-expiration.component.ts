import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material';
import { PartoshiAmount } from 'app/core/util/utils';
import { TemplateService } from 'app/core/market/api/template/template.service';
import { ListingExpiryConfig } from 'app/modals/models/listingExpiry.modal.config.interface';

interface ListingExpiryIface {
  title: string,
  value: number,
  estimateFee: PartoshiAmount,
  error?: string,
  isDisabled: boolean
}
@Component({
  selector: 'app-listing-expiration',
  templateUrl: './listing-expiration.component.html',
  styleUrls: ['./listing-expiration.component.scss']
})
export class ListingExpirationComponent {

  @Output() onConfirm: EventEmitter<string> = new EventEmitter<string>();
  @Output() onCancel: EventEmitter<string> = new EventEmitter<string>();
  txFee: string = '';
  txError: string = '';
  expiration: number = 0;
  estimateError: boolean = false;

  expiredList: Array<ListingExpiryIface> = [
    { title: '1 day', value: 1, estimateFee: new PartoshiAmount(0), isDisabled: false },
    { title: '2 days', value: 2, estimateFee: new PartoshiAmount(0), isDisabled: false },
    { title: '4 days', value: 4, estimateFee: new PartoshiAmount(0), isDisabled: false },
    { title: '1 week', value: 7, estimateFee: new PartoshiAmount(0), isDisabled: false },
    { title: '2 weeks', value: 14, estimateFee: new PartoshiAmount(0), isDisabled: true },
    { title: '3 weeks', value: 21, estimateFee: new PartoshiAmount(0), isDisabled: true },
    { title: '4 weeks', value: 28, estimateFee: new PartoshiAmount(0), isDisabled: true }
  ];
  callback: Function;

  constructor(
    private dialogRef: MatDialogRef<ListingExpirationComponent>,
    private templateService: TemplateService
  ) { }

  confirm(): void {

    if (this.callback) {
      this.callback(this.expiration);
    }

    this.onConfirm.emit();
    this.dialogClose();
  }

  dialogClose(): void {
    this.onCancel.emit();
    this.dialogRef.close();
  }

  setData(data: ListingExpiryConfig, callback: Function): void {
    this.callback = callback;
    this.getEstimateFor(data.template, this.expiredList[0])
      .then(() => {
        for (let i = 1; i < this.expiredList.length; i++) {
          this.getEstimateFor(data.template, this.expiredList[i]);
        }
      },
      () => {
        this.estimateError = true;
      });
  }

  loadTransactionFee() {
    const expiryItem = this.expiredList.find((val) => +val.value === this.expiration);
    this.txFee = expiryItem ?
      `${expiryItem.estimateFee.particlsString()}` :
      '';
    this.txError = expiryItem ? (expiryItem.error || '') : 'unknown';
  }

  private getEstimateFor(template: any, expiredItem: ListingExpiryIface): Promise<any> {
    return new Promise ((resolve, reject) => {
    if (!expiredItem.isDisabled && expiredItem.value > 0) {
      this.templateService
        .post(template, 1, expiredItem.value, true)
        .toPromise().then(
          resp => {
            if (+resp.fee > 0) {
              expiredItem.estimateFee = new PartoshiAmount(+resp.fee * Math.pow(10, 8));
              if (this.expiration === expiredItem.value) {
                this.loadTransactionFee();
              }
              resolve();
            }
          }, err => {
            expiredItem.error = 'Insufficient funds';
            reject();
          }
        ).catch(
          err => {
            // nothing to do, leave the estimate as not being set
          }
        );
      }
    });
  }
}
