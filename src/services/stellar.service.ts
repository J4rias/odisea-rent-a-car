import {
  Asset,
  BASE_FEE,
  Claimant,
  contract,
  Horizon,
  Keypair,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  CONTRACT_ADDRESS,
  HORIZON_NETWORK_PASSPHRASE,
  HORIZON_URL,
  SOROBAN_RPC_URL,
  STELLAR_FRIENDBOT_URL,
  STELLAR_NETWORK,
} from "../utils/constants";
import { IKeypair } from "../interfaces/keypair";
import { IAccountBalanceResponse } from "../interfaces/balance";
import { AccountBalance } from "../interfaces/account";
import { ICreateClaimableBalanceResponse } from "../interfaces/claimable-balance";

export class StellarService {
  private network: string;
  private horizonUrl: string;
  private rpcUrl: string;
  private server: Horizon.Server;
  private rpcServer: rpc.Server;
  private friendBotUrl: string;
  private networkPassphrase: string;
  private contractAddress: string;

  constructor() {
    this.network = STELLAR_NETWORK as string;
    this.horizonUrl = HORIZON_URL as string;
    this.rpcUrl = SOROBAN_RPC_URL as string;
    this.friendBotUrl = STELLAR_FRIENDBOT_URL as string;
    this.networkPassphrase = HORIZON_NETWORK_PASSPHRASE as string;
    this.contractAddress = CONTRACT_ADDRESS as string;

    this.server = new Horizon.Server(this.horizonUrl, {
      allowHttp: true,
    });
    this.rpcServer = new rpc.Server(this.rpcUrl, {
      allowHttp: true,
    });
  }

  async buildClient<T = unknown>(publicKey: string): Promise<T> {
    const client = await contract.Client.from({
      contractId: this.contractAddress,
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
      publicKey,
    });

    return client as T;
  }


  async submitTransaction(xdr: string): Promise<string | undefined> {
    try {
      const transaction = TransactionBuilder.fromXDR(
        xdr,
        this.networkPassphrase
      );
      const result = await this.server.submitTransaction(transaction);

      return result.hash;
    } catch (error) {
      console.error(error);
      if (error.response?.data?.extras?.result_codes) {
        console.error(
          "❌ Error en la transacción:",
          error.response.data.extras.result_codes
        );
      } else {
        console.error("❌ Error general:", error);
      }
    }
  }
  
  environment(): { rpc: string; networkPassphrase: string } {
    return {
      rpc: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
    };
  }

  private async getAccount(address: string): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(address);
    } catch (error) {
      throw new Error("Account not found");
    }
  }

  getAsset(assetCode: string, assetIssuer: string): Asset {
    if (assetCode !== "XLM") {
      return new Asset(assetCode, assetIssuer);
    } else {
      return Asset.native();
    }
  }

  async getAccountBalance(publicKey: string): Promise<AccountBalance[]> {
    const account = await this.getAccount(publicKey);

    return account.balances.map((b) => ({
      assetCode:
        b.asset_type === "native"
          ? "XLM"
          : (b as IAccountBalanceResponse).asset_code,

      amount: b.balance,
    }));
  }

  createAccount(): IKeypair {
    const pair = Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
    };
  }

  async fundAccount(publicKey: string): Promise<boolean> {
    try {
      if (this.network !== "testnet") {
        throw new Error("Friendbot is only available on testnet");
      }

      const response = await fetch(`${this.friendBotUrl}?addr=${publicKey}`);

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error: unknown) {
      throw new Error(
        `Error when funding account with Friendbot: ${error as string}`
      );
    }
  }

  private async loadAccount(address: string): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(address);
    } catch (error) {
      console.error(error);
      throw new Error("Account not found");
    }
  }

  private transactionBuilder(sourceAccount: Horizon.AccountResponse) {
    return new TransactionBuilder(sourceAccount, {
      networkPassphrase: this.networkPassphrase,
      fee: BASE_FEE,
    });
  }

  async createAsset(
    issuerSecret: string,
    distributorSecret: string,
    assetCode: string,
    amount: string
  ) {
    const issuerKeys = Keypair.fromSecret(issuerSecret);
    const distributorKeys = Keypair.fromSecret(distributorSecret);
    const newAsset = new Asset(assetCode, issuerKeys.publicKey());
    const assetLimit = Number(amount) * 100;

    try {
      const distributorAccount = await this.loadAccount(
        distributorKeys.publicKey()
      );

      const trustTransaction = new TransactionBuilder(distributorAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset: newAsset,
            source: distributorKeys.publicKey(),
            limit: assetLimit.toString(),
          })
        )
        .setTimeout(30)
        .build();

      trustTransaction.sign(distributorKeys);
      await this.server.submitTransaction(trustTransaction);

      const issuerAccount = await this.loadAccount(issuerKeys.publicKey());

      const issueTransaction = new TransactionBuilder(issuerAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: distributorKeys.publicKey(),
            asset: newAsset,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      issueTransaction.sign(issuerKeys);
      const response = await this.server.submitTransaction(issueTransaction);

      return response;
    } catch (error) {
      console.error("Error creating asset:", error);
      throw error;
    }
  }

  private createPaymentOperation(
    amount: string,
    asset: Asset,
    destination: string
  ): xdr.Operation<Operation> {
    return Operation.payment({
      amount,
      asset,
      destination,
    });
  }

  private async checkTrustline(
    assetIssuer: string,
    assetCode: string,
    destinationPubKey: string
  ): Promise<boolean> {
    const account = await this.loadAccount(destinationPubKey);
    const balances = account.balances;
    const assetToVerify = new Asset(assetCode, assetIssuer);

    for (const balance of balances) {
      if ("asset_code" in balance) {
        const asset = new Asset(balance.asset_code, balance.asset_issuer);

        if (asset.equals(assetToVerify)) return true;
      }
    }

    return false;
  }

  createTrustlineOperation(
    asset: Asset,
    source: string,
    amount: string
  ): xdr.Operation<Operation.ChangeTrust> {
    const assetLimit = Number(amount) * 100;

    return Operation.changeTrust({
      asset,
      source,
      limit: assetLimit.toString(),
    });
  }

  async payment(
    senderPubKey: string,
    senderSecret: string,
    receiverPubKey: string,
    receiverSecret: string,
    amount: string,
    assetCode: string
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    const sourceAccount = await this.loadAccount(senderPubKey);
    const sourceKeypair = Keypair.fromSecret(senderSecret);
    let hasTrustline: boolean = true;

    const asset = this.getAsset(assetCode, receiverPubKey);
    const transactionBuilder = this.transactionBuilder(sourceAccount);

    if (asset.code !== "XLM" && asset.issuer !== receiverPubKey) {
      hasTrustline = await this.checkTrustline(
        receiverPubKey,
        assetCode,
        asset.issuer
      );

      if (!hasTrustline) {
        const changeTrustOp = this.createTrustlineOperation(
          asset,
          receiverPubKey,
          amount
        );
        transactionBuilder.addOperation(changeTrustOp);
      }
    }

    const paymentOperation = this.createPaymentOperation(
      amount,
      asset,
      receiverPubKey
    );

    transactionBuilder.addOperation(paymentOperation);

    const transaction = transactionBuilder.setTimeout(180).build();

    transaction.sign(sourceKeypair);

    if (!hasTrustline) {
      const recieveKeypair = Keypair.fromSecret(receiverSecret);
      transaction.sign(recieveKeypair);
    }

    return await this.submitTransaction(transaction);
  }

  async createClaimableBalance(
    assetCode: string,
    amount: string,
    senderSecretKey: string,
    destinationSecretKey: string
  ): Promise<ICreateClaimableBalanceResponse> {
    const sourceKeypair = Keypair.fromSecret(senderSecretKey);
    const destinationKeypair = Keypair.fromSecret(destinationSecretKey);
    const sourceAccount = await this.server.loadAccount(
      sourceKeypair.publicKey()
    );

    const asset = this.getAsset(assetCode, sourceKeypair.publicKey());
    console.log({ asset });

    const claimants = [
      new Claimant(
        sourceKeypair.publicKey(),
        Claimant.predicateUnconditional()
      ),
      new Claimant(
        destinationKeypair.publicKey(),
        Claimant.predicateUnconditional()
      ),
    ];

    const createClaimableBalanceOperation = Operation.createClaimableBalance({
      amount: amount.toString(),
      asset,
      claimants: claimants,
    });

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(createClaimableBalanceOperation)
      .setTimeout(180)
      .build();

    const claimableBalanceId = transaction.getClaimableBalanceId(0);

    transaction.sign(sourceKeypair);
    const response = await this.submitTransaction(transaction);
    return {
      transaction: response,
      claimableBalanceId,
    };
  }

  async claimClaimableBalance(
    claimant: string,
    claimableBalanceId: string
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    const claimantKeypair = Keypair.fromSecret(claimant);
    const claimantAccount = await this.server.loadAccount(
      claimantKeypair.publicKey()
    );

    const transaction = new TransactionBuilder(claimantAccount, {
      fee: (await this.server.fetchBaseFee()).toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.claimClaimableBalance({
          balanceId: claimableBalanceId,
          source: claimantKeypair.publicKey(),
        })
      )
      .setTimeout(180)
      .build();

    transaction.sign(claimantKeypair);

    return await this.submitTransaction(transaction);
  }
}

export const stellarService = new StellarService();
