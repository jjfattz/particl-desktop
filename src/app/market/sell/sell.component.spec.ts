import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { CoreUiModule } from 'app/core-ui/core-ui.module';
import { CoreModule } from 'app/core/core.module';
import { ModalsModule } from 'app/modals/modals.module';
import { SettingsModule } from 'app/settings/settings.module';

import { SellComponent } from './sell.component';
import { RpcWithStateModule } from 'app/core/rpc/rpc.module';
import { MultiwalletModule } from 'app/multiwallet/multiwallet.module';

describe('SellComponent', () => {
  let component: SellComponent;
  let fixture: ComponentFixture<SellComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SellComponent ],
      imports: [
        HttpClientTestingModule,
        CoreModule.forRoot(),
        CoreUiModule.forRoot(),
        ModalsModule.forRoot(),
        RouterTestingModule,
        BrowserAnimationsModule,
        RpcWithStateModule.forRoot(),
        MultiwalletModule.forRoot(),
        SettingsModule.forRoot()
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SellComponent);
    component = fixture.componentInstance;
    component.pagination.infinityScrollSelector = '.test-case-container';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
