import {
  Component, EventEmitter, OnDestroy, OnInit, Output,
  ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Log } from 'ng2-logger';
import { MatStepper } from '@angular/material';

import { ProfileService } from 'app/core/market/api/profile/profile.service';
import { CartService } from 'app/core/market/api/cart/cart.service';
import { Cart } from 'app/core/market/api/cart/cart.model';
import { ShippingDetails } from '../../shared/shipping-details.model';
import { CountryListService } from 'app/core/market/api/countrylist/countrylist.service';
import { MarketService } from '../../../core/market/market.service';
import { SnackbarService } from '../../../core/snackbar/snackbar.service';
import { BidService } from 'app/core/market/api/bid/bid.service';
import { RpcStateService } from 'app/core/rpc/rpc-state/rpc-state.service';
import { ModalsService } from 'app/modals/modals.service';
import { MatDialog, MatDialogRef } from '@angular/material';
import { PlaceOrderComponent } from '../../../modals/place-order/place-order.component';

@Component({
  selector: 'app-checkout-process',
  templateUrl: './checkout-process.component.html',
  styleUrls: ['./checkout-process.component.scss']
})
export class CheckoutProcessComponent implements OnInit, OnDestroy {

  private log: any = Log.create('buy.component: ' + Math.floor((Math.random() * 1000) + 1));

  @Output() onOrderPlaced: EventEmitter<number> = new EventEmitter<number>();
  @ViewChild('stepper') stepper: MatStepper;
  public cartFormGroup: FormGroup;
  public shippingFormGroup: FormGroup;
  public newShipping: boolean;
  public selectedAddress: ShippingDetails;

  public profile: any = {};

  /* cart */
  public cart: Cart;

  constructor(// 3rd party
    private formBuilder: FormBuilder,
    private router: Router,
    // core
    private snackbarService: SnackbarService,
    private rpcState: RpcStateService,
    private modals: ModalsService,
    // market
    private market: MarketService,
    private profileService: ProfileService,
    private cartService: CartService,
    public countryList: CountryListService,
    private bid: BidService,
    public dialog: MatDialog) {
  }

  ngOnInit() {
    this.formBuild();

    this.getProfile();

    this.getCart();
  }

  ngOnDestroy() {
    this.setShippingCache();
  }

  //@TODO create saparate service for checkout process.
  setShippingCache() {
    this.setSteperIndex();
    this.profileService.shippingDetails = this.shippingFormGroup.value;
  }

  formBuild() {
    this.cartFormGroup = this.formBuilder.group({
      firstCtrl: ['']
    });

    this.shippingFormGroup = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      city: ['', Validators.required],
      state: [''],
      country: ['', Validators.required],
      zipCode: ['', Validators.required],
      newShipping: [''],
      title: ['']
    });
  }

  /* cart */

  goToListings(): void {
    this.router.navigate(['/market/overview']);
  }

  removeFromCart(shoppingCartId: number): void {
    this.cartService.removeItem(shoppingCartId).take(1)
      .subscribe(this.getCart);
  }

  clearCart(isSnack: boolean = true): void {
    this.cartService.clearCart().subscribe(res => {
      if (isSnack) {
        this.snackbarService.open('All Items Cleared From Cart');
      }
      this.getCart()
    });
  }

  // Should follow es6
  getCart = () => {
    this.cartService.getCart().take(1).subscribe(cart => this.cart = cart);
  }

  /* shipping */

  updateShippingAddress(): void {
    if (!this.profile) {
      this.snackbarService.open('Profile was not fetched!');
      return;
    }

    let upsert: Function;
    if (this.profile.ShippingAddresses.length === 0 || this.newShipping) {
      upsert = this.profileService.addShippingAddress.bind(this);
    } else {
      this.shippingFormGroup.value.id = this.selectedAddress.id;
      upsert = this.profileService.updateShippingAddress.bind(this);
    }

    this.setShippingCache();
    upsert(this.shippingFormGroup.value).take(1).subscribe(address => {
      this.getProfile();
    });

  }

  setValue(address: ShippingDetails) {
    console.log('catched address', address);
    this.shippingFormGroup.patchValue(address);
  }

  getProfile(): void {
    this.profileService.get(1).take(1).subscribe(
      profile => {
        this.profile = profile;
        console.log('--- profile address ----');
        console.log(profile);
        const addresses = profile.ShippingAddresses;
        if (addresses.length > 0) {
          this.setSteperIndex();
          this.selectedAddress = (this.profileService.shippingDetails) ? this.profileService.shippingDetails : addresses[0];
          this.setValue(this.selectedAddress);
        }
      });
  }

  valueOf(field: string) {
    return this.shippingFormGroup ? this.shippingFormGroup.get(field).value : '';
  }

  placeOrderModal(): void {
    let dialogRef = this.dialog.open(PlaceOrderComponent);
    dialogRef.afterClosed().subscribe((res) => {
      if (res === undefined) {
        this.placeOrder();
      }
      });
  }


  placeOrder() {
    if (this.rpcState.get('locked')) {
      // unlock wallet and send transaction
      this.modals.open('unlock', {forceOpen: true, timeout: 30, callback: this.bidOrder.bind(this)});
    } else {
      // wallet already unlocked
      this.bidOrder();
    }
  }

  bidOrder() {
    this.bid.order(this.cart, this.profile).subscribe((res) => {
      this.clearCart(false);
      this.clearCache();
      this.snackbarService.open('Order has been successfully placed');
      this.onOrderPlaced.emit(1);
    }, (error) => {
      this.log.d(`Error while placing an order`);
    });
  }
  
  clearCache() {
    this.profileService.shippingDetails = new ShippingDetails()
  }

  setSteperIndex() {
    this.profileService.stepper = this.stepper.selectedIndex;
  }
}
