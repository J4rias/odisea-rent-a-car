use soroban_sdk::{Address, Env, Symbol};

pub(crate) fn admin_fee_set(env: &Env, admin: Address, fee: i128) {
    let topics = (Symbol::new(env, "admin_fee_set"), admin.clone());
    env.events().publish(topics, fee);
}

pub(crate) fn admin_withdraw(env: &Env, admin: Address, amount: i128) {
    let topics = (Symbol::new(env, "admin_withdraw"), admin.clone());
    env.events().publish(topics, amount);
}
