use soroban_sdk::{Address, Env};
use crate::{events, storage::{admin::{has_admin, write_admin}, token::write_token, types::error::Error}};

pub fn initialize(env: &Env, admin: Address, token: Address) -> Result<(), Error> {

        if admin == token {
            return Err(Error::AdminTokenConflict);
        }

        if has_admin(&env) {
            return Err(Error::ContractInitialized);
        }

        write_admin(env, &admin);
        write_token(env, &token);

        events::contract::contract_initialized(env, admin, token);
        Ok(())
    }