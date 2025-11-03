use soroban_sdk::{Address, Env};

use crate::storage::{structs::car::Car, types::{error::Error, storage::DataKey}};

pub(crate) fn has_car(env: &Env, owner: &Address) -> bool {
    env.storage().instance().has(&DataKey::Car(owner.clone()))
}

pub(crate) fn read_car(env: &Env, owner: &Address) -> Result<Car, Error> {
    env.storage().instance().get(&DataKey::Car(owner.clone())).ok_or(Error::CarNotFound)
}

pub(crate) fn write_car(env: &Env, owner: &Address, car: &Car) {
    env.storage().instance().set(&DataKey::Car(owner.clone()), car);
}

pub(crate) fn storage_remove_car(env: &Env, owner: &Address) {
    env.storage().instance().remove(&DataKey::Car(owner.clone()));
}