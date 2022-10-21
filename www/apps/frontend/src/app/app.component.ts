import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, OnDestroy } from '@angular/core';

import { CommonModule, DOCUMENT } from '@angular/common';
import { Subscription, map } from 'rxjs';

import { HeaderComponent } from '@casper-ui/header';
import { UsersService } from '@casper-data/data-access-users';
import { Users, User, Roles, Purse } from '@casper-api/api-interfaces';
import { ESCROW_TOKEN } from '@casper-util/wasm';
import { Escrow } from "escrow";
import { CasperLabsHelper } from 'casper-js-sdk/dist/@types/casperlabsSigner';
import { RouterModule } from '@angular/router';
import { RouteurHubService } from '@casper-util/routeur-hub';

declare global {
  interface Window {
    casperlabsHelper: CasperLabsHelper;
  }
}

const imports = [
  CommonModule,
  RouterModule,
  HeaderComponent
];

@Component({
  selector: 'casper-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports,
  providers: [
    UsersService,
    RouteurHubService
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly window = this.document.defaultView;
  isConnected!: boolean;
  activePublicKey!: string;
  users!: Users;
  user?: User;
  balance!: string;

  readonly Roles = Roles;

  private usersSubscription!: Subscription;
  private accountInformationSubscription!: Subscription;
  subscriptions: Subscription[] = [];

  private _activePublicKey!: string; // memoize activePublicKey

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(ESCROW_TOKEN) private readonly escrow: Escrow,
    private readonly usersService: UsersService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly routeurHubService: RouteurHubService
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.setRouteurHubSubscriptions();
    this.setUsersSubscription();
    await this.refreshData();
    this.window?.addEventListener('signer:unlocked', async () => await this.refreshData());
    this.window?.addEventListener('signer:activeKeyChanged', async () => await this.refreshData());
    this.escrow.hello();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => {
      subscription && subscription.unsubscribe();
    });
  }

  async connect() {
    try {
      this.window?.casperlabsHelper?.requestConnection();
      await this.refreshData();
    } catch (error) { console.error(error); }
  }

  private refreshPurse() {
    this.setAccountInformationSubscription();
  }

  private setRouteurHubSubscriptions() {
    this.subscriptions.push(this.routeurHubService.connect$.subscribe(async () => {
      this.connect();
    }));
    this.subscriptions.push(this.routeurHubService.refreshPurse$.subscribe(async () => {
      this.refreshPurse();
    }));
  }

  private setUsersSubscription() {
    this.usersSubscription = this.usersService.get().subscribe(users => {
      this.users = users;
      this.changeDetectorRef.markForCheck();
      this.usersSubscription.unsubscribe();
    });
  }

  private async refreshData() {
    await this.setActivePublicKey();
    this.setActiveUser();
    this.setPurse();
  }

  private async setActivePublicKey() {
    const isConnected$ = this.window?.casperlabsHelper?.isConnected(),
      activePublicKey$ = this.window?.casperlabsHelper?.getActivePublicKey();
    const promises = await Promise.allSettled([isConnected$, activePublicKey$])
      .catch(error => console.error(error));
    const results = promises?.filter(
      ({ status }) => status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<string | boolean>).value);
    let isConnected, activePublicKey;
    results && ([isConnected, activePublicKey] = results);
    activePublicKey = activePublicKey as string;
    this.activePublicKey = activePublicKey as string;
    this.isConnected = (this.activePublicKey && isConnected) as boolean;
  }

  private setActiveUser() {
    this.user = this.users?.find((user: User) => user.activePublicKey == this.activePublicKey) as User;
    this.routeurHubService.setState({ user: this.user });
  }

  private setPurse() {
    if (
      !this.isConnected ||
      !this.activePublicKey ||
      // Do not retrieve activePublicKey if it has not changed
      this._activePublicKey === this.activePublicKey
    ) {
      return;
    }
    // memoize activePublicKey
    this._activePublicKey = this.activePublicKey;
    this.setAccountInformationSubscription();
  }

  private setAccountInformationSubscription() {
    this.activePublicKey && (this.accountInformationSubscription = this.usersService.getPurse(this.activePublicKey)
      .pipe(
        map((purse: Purse | Error) =>
          purse as Purse
        )
      ).subscribe(
        (purse => {
          this.balance = this.getBalance(purse);
          this.changeDetectorRef.markForCheck();
          this.accountInformationSubscription.unsubscribe();
        })
      ));
  }

  private getBalance(purse: Purse) {
    if (!purse?.balance) {
      return (0).toString();
    }
    return (+purse?.balance / 1e+10).toLocaleString();
  }

}
