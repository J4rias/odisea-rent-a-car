use soroban_sdk::{testutils::Address as _, Address, vec, IntoVal, Symbol};
use crate::{storage::{car::read_car, contract_balance::read_contract_balance, rental::read_rental, types::car_status::CarStatus}, tests::config::{contract::ContractTest, utils::get_contract_events}};

#[test]
pub fn test_rental_car_successfully() {
    let ContractTest { env, contract, token, .. } = ContractTest::setup();

    env.mock_all_auths();

    let owner = Address::generate(&env);
    let renter = Address::generate(&env);
    let price_per_day = 1500_i128;
    let total_days = 3;
    let amount = 4500_i128;
    
    let (_, token_admin, _) = token;

    let amount_mint = 10_000_i128;
    token_admin.mint( &renter, &amount_mint);

    contract.add_car(&owner, &price_per_day);

    let initial_contract_balance = env.as_contract(&contract.address, || read_contract_balance(&env));
    assert_eq!(initial_contract_balance, 0);

    contract.rental(&renter, &owner, &total_days, &amount);
    let contract_events = get_contract_events(&env, &contract.address);

    let updated_contract_balance = env.as_contract(&contract.address, || read_contract_balance(&env));
    assert_eq!(updated_contract_balance, amount);

    let car = env.as_contract(&contract.address, || read_car(&env, &owner)).unwrap();
    assert_eq!(car.car_status, CarStatus::Rented);
    assert_eq!(car.available_to_withdraw, amount);

    let rental = env.as_contract(&contract.address, || read_rental(&env, &renter, &owner)).unwrap();
    assert_eq!(rental.total_days_to_rent, total_days);
    assert_eq!(rental.amount, amount);
    assert_eq!(
        contract_events,
        vec![
            &env,
            (
                contract.address.clone(),
                vec![
                    &env,
                    *Symbol::new(&env, "rented").as_val(),
                    renter.clone().into_val(&env),
                    owner.clone().into_val(&env),
                ],
                (total_days, amount).into_val(&env)
            )
        ]
    );
}