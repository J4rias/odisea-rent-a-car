use crate::storage::types::storage::DataKey;
use soroban_sdk::Env;

pub fn read_admin_fee(env: &Env) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::AdminFee)
        .unwrap_or(0)
}

pub fn write_admin_fee(env: &Env, fee: &i128) {
    env.storage().persistent().set(&DataKey::AdminFee, fee);
}
