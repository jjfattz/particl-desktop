import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreUiModule } from 'app/core-ui/core-ui.module';
import { TopbarComponent } from './topbar/topbar.component';
import { StatusComponent } from './status/status.component';
import { VersionComponent } from './version/version.component';
import { CountdownTimerComponent } from './countdown-timer/countdown-timer.component';
import { MainLayoutDefaultComponent } from './layout-default/main-layout-default.component';
import { LoadingPlaceholderComponent } from './loading-placeholder/loading-placeholder.component';
import { BlockSyncIndicatorComponent } from './block-sync-indicator/block-sync-indicator.component';


@NgModule({
  declarations: [
    StatusComponent,
    TopbarComponent,
    VersionComponent,
    CountdownTimerComponent,
    MainLayoutDefaultComponent,
    LoadingPlaceholderComponent,
    BlockSyncIndicatorComponent,
  ],
  imports: [
    CommonModule,
    CoreUiModule
  ],
  exports: [
    TopbarComponent,
    CountdownTimerComponent,
    MainLayoutDefaultComponent,
    LoadingPlaceholderComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MainSharedModule {
  constructor() {
  }
}
