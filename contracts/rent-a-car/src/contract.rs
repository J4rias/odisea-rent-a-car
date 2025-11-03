use crate::{
    events, interfaces::contract::RentACarContractTrait, methods::{admin::{add_car::add_car, remove_car::remove_car}, public::{get_car_status::get_car_status, initialize::initialize}, token::token::token_transfer}, storage::{
        car::{read_car, write_car}, contract_balance::{read_contract_balance, write_contract_balance}, rental::write_rental, structs::rental::Rental, types::{car_status::CarStatus, error::Error}
    }
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

        if car.car_status != CarStatus::Available {
            return Err(Error::CarAlreadyRented);
        }

        token_transfer(&env, &renter, &env.current_contract_address(), &amount)?;

        car.car_status = CarStatus::Rented;
        car.available_to_withdraw = car.available_to_withdraw.checked_add(amount).ok_or(Error::OverflowError)?;

        let rental = Rental {
            total_days_to_rent,
            amount,
        };

        let mut contract_balance = read_contract_balance(&env);
        contract_balance = contract_balance.checked_add(amount).ok_or(Error::OverflowError)?;

        write_contract_balance(&env, &contract_balance);
        write_car(env, &owner, &car);
        write_rental(env, &renter, &owner, &rental);

        events::rental::rented(env, renter, owner, total_days_to_rent, amount);
        Ok(())
    }

    fn payout_owner(env: &Env, owner: Address, amount: i128) -> Result<(), Error> {
        owner.require_auth();

         if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        let mut car = read_car(&env, &owner)?;

        if amount > car.available_to_withdraw {
            return Err(Error::InsufficientBalance);
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
}