use crate::{
    events, interfaces::contract::RentACarContractTrait,
    methods::{admin::{add_car::add_car, remove_car::remove_car}, public::{get_car_status::get_car_status, initialize::initialize}, token::token::token_transfer},
    storage::{admin_balance::{read_admin_balance, write_admin_balance}, admin_fee::{read_admin_fee, write_admin_fee}, car::{read_car, write_car}, contract_balance::{read_contract_balance, write_contract_balance}, rental::{has_rental, remove_rental, write_rental}, structs::rental::Rental, types::{car_status::CarStatus, error::Error}},
};
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct RentACarContract;

#[contractimpl]
impl RentACarContractTrait for RentACarContract {
    fn __constructor(env: &Env, admin: Address, token: Address) -> Result<(), Error> {

        initialize(env, admin, token)
    }

    fn add_car(env: &Env, owner: Address, price_per_day: i128) -> Result<(), Error> {
        add_car(env, owner, price_per_day)
    }

    fn get_car_status(env: &Env, owner: Address) -> Result<CarStatus, Error> {

        get_car_status(env, &owner)
    }

    fn rental(env: &Env, renter: Address, owner: Address, total_days_to_rent: u32, amount: i128) -> Result<(), Error> {
        renter.require_auth();

        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        if total_days_to_rent == 0 {
            return Err(Error::RentalDurationCannotBeZero);
        }

        if renter == owner {
            return Err(Error::SelfRentalNotAllowed);
        }

        let mut car = read_car(env, &owner)?;

        if has_rental(&env, &owner, &owner) || car.car_status != CarStatus::Available {
            return Err(Error::RentalNotFound);
        }

        let admin_fee = read_admin_fee(env);
        let to_transfer = amount.checked_add(admin_fee).ok_or(Error::OverflowError)?;
        token_transfer(&env, &renter, &env.current_contract_address(), &to_transfer)?;

        car.car_status = CarStatus::Rented;
        car.available_to_withdraw = car
            .available_to_withdraw
            .checked_add(amount)
            .ok_or(Error::OverflowError)?;

        let rental = Rental {
            total_days_to_rent,
            amount,
        };

        let mut contract_balance = read_contract_balance(&env);
        let mut admin_balance = read_admin_balance(&env);
        contract_balance = contract_balance.checked_add(to_transfer).ok_or(Error::OverflowError)?;
        admin_balance = admin_balance.checked_add(admin_fee).ok_or(Error::OverflowError)?;

        write_contract_balance(&env, &contract_balance);
        write_car(env, &owner, &car);
        write_rental(env, &renter, &owner, &rental);
        write_admin_balance(&env, &admin_balance);

        events::rental::rented(env, renter, owner, total_days_to_rent, amount);
        Ok(())
    }

    fn payout_owner(env: &Env, owner: Address, amount: i128) -> Result<(), Error> {
        owner.require_auth();

         if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        let mut car = read_car(&env, &owner)?;

        if car.car_status != CarStatus::Available {
            return Err(Error::RentalNotFound);
        }
        if car.available_to_withdraw < amount {
            return Err(Error::BalanceNotAvailableForAmountRequested);
        }

        let mut contract_balance = read_contract_balance(&env);

        if amount > contract_balance {
            return Err(Error::BalanceNotAvailableForAmountRequested);
        }

        token_transfer(&env, &env.current_contract_address(), &owner, &amount)?;

        car.available_to_withdraw = car.available_to_withdraw.checked_sub(amount).ok_or(Error::UnderflowError)?;
        contract_balance = contract_balance.checked_sub(amount).ok_or(Error::UnderflowError)?;

        write_car(&env, &owner, &car);
        write_contract_balance(&env, &contract_balance);

        events::payout_owner::payout_owner(env, owner, amount);
        Ok(())
    }

    fn remove_car(env: &Env, owner: Address) -> Result<(), Error> {

        remove_car(env, owner)

    }

    fn set_admin_fee(env: &Env, fee: i128) -> Result<(), Error> {
        let admin = crate::storage::admin::read_admin(env)?;
        admin.require_auth();
        if fee < 0 { return Err(Error::AmountMustBePositive); }
        write_admin_fee(env, &fee);
        events::admin::admin_fee_set(env, admin, fee);
        Ok(())
    }

    fn admin_withdraw(env: &Env, amount: i128) -> Result<(), Error> {
        if amount <= 0 { return Err(Error::AmountMustBePositive); }
        let admin = crate::storage::admin::read_admin(env)?;
        admin.require_auth();

        let mut contract_balance = read_contract_balance(env);
        let mut admin_balance = read_admin_balance(env);
        if admin_balance < amount { return Err(Error::InsufficientBalance); }

        token_transfer(&env, &env.current_contract_address(), &admin, &amount)?;
        admin_balance = admin_balance.checked_sub(amount).ok_or(Error::UnderflowError)?;
        contract_balance = contract_balance.checked_sub(amount).ok_or(Error::UnderflowError)?;

        write_admin_balance(env, &admin_balance);
        write_contract_balance(env, &contract_balance);
        events::admin::admin_withdraw(env, admin, amount);
        Ok(())
    }

    fn get_owner_balance(env: &Env, owner: Address) -> Result<i128, Error> {
        let car = read_car(env, &owner)?;
        Ok(car.available_to_withdraw)
    }

    fn get_admin_fee(env: &Env) -> Result<i128, Error> {
        let fee = crate::storage::admin_fee::read_admin_fee(env);
        Ok(fee)
    }

    fn return_car(env: &Env, renter: Address, owner: Address) -> Result<(), Error> {
        if !has_rental(&env, &renter, &owner) {
            return Err(Error::RentalNotFound);
        }
        let mut car = read_car(&env, &owner)?;
        car.car_status = CarStatus::Available;
        write_car(&env, &owner, &car);
        remove_rental(&env, &renter.clone(), &owner.clone());
        Ok(())
    }
}