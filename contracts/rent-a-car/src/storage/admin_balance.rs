use crate::storage::types::storage::DataKey;
use soroban_sdk::Env;

pub fn read_admin_balance(env: &Env) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::AdminBalance)
        .unwrap_or(0)
}

pub fn write_admin_balance(env: &Env, amount: &i128) {
    env.storage()
        .persistent()
        .set(&DataKey::AdminBalance, amount);
}
