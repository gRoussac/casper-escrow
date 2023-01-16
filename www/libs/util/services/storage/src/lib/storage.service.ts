import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { State } from '@casper-api/api-interfaces';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private readonly window = this.document.defaultView;
  private readonly prefix = 'casper-deployer';

  constructor(
    @Inject(DOCUMENT) private document: Document,
  ) { }

  setState(state: State) {
    const storage = JSON.parse(this.window?.localStorage.getItem(this.prefix) || '{}');
    const new_storage = {
      ...storage,
      ...state
    };
    this.window?.localStorage.setItem(this.prefix, JSON.stringify(new_storage));
  }

  // set(key: string, state: State) {
  //   this.window?.localStorage.setItem(this.prefix + key, JSON.stringify(state));
  // }

  get(key: string) {
    return (JSON.parse(this.window?.localStorage.getItem(this.prefix) || '{}') || {})[key];
  }
}
