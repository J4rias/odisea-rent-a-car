use soroban_sdk::{Env, Address};
use crate::storage::{car::read_car, types::{car_status::CarStatus, error::Error}};

pub fn get_car_status(env: &Env, owner: &Address) -> Result<CarStatus, Error> {
    let car = read_car(env, owner)?;

    Ok(car.car_status)
}
