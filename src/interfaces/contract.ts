import type { ClientOptions } from "@stellar/stellar-sdk/contract";
import { CarStatus } from "./car-status";

export interface IBaseContractClient {
  readonly options: ClientOptions;
  toXDR(): string;
}

export interface IRentACarContract extends IBaseContractClient {
  __constructor: ({
    admin,
    token,
  }: {
    admin: string;
    token: string;
  }) => Promise<this>;

  add_car: ({
    owner,
    price_per_day,
  }: {
    owner: string;
    price_per_day: number;
  }) => Promise<this>;

  get_car_status: ({ owner }: { owner: string }) => Promise<CarStatus>;

  rental: ({
    renter,
    owner,
    total_days_to_rent,
    amount,
  }: {
    renter: string;
    owner: string;
    total_days_to_rent: number;
    amount: number;
  }) => Promise<this>;

  remove_car: ({ owner }: { owner: string }) => Promise<this>;

  payout_owner: ({
    owner,
    amount,
  }: {
    owner: string;
    amount: number;
  }) => Promise<this>;
}