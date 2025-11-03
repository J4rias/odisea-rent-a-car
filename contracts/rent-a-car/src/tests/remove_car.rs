use soroban_sdk::{Address, vec, IntoVal, Symbol, testutils::{Address as _, MockAuth, MockAuthInvoke}};
use crate::{storage::car::has_car, tests::config::{contract::ContractTest, utils::get_contract_events}};

#[test]
pub fn test_remove_car_deletes_from_storage() {
    let ContractTest { env, contract, .. } = ContractTest::setup();

    let owner = Address::generate(&env);
    let price_per_day = 1500_i128;

    env.mock_all_auths();
    contract.add_car(&owner, &price_per_day);
    assert!(env.as_contract(&contract.address, || {
        has_car(&env, &owner)
    }));

    contract.remove_car(&owner);
    let contract_events = get_contract_events(&env, &contract.address);

    assert!(!env.as_contract(&contract.address, || {
        has_car(&env, &owner)
    }));
    assert_eq!(
        contract_events,
        vec![
            &env,
            (
                contract.address.clone(),
                vec![
                    &env,
                    *Symbol::new(&env, "car_removed").as_val(),
                    owner.clone().into_val(&env),
                ],
                ().into_val(&env)
            )
        ]
    );
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
pub fn test_unauthorized_user_cannot_remove_car() {
    let ContractTest { env, contract, .. } = ContractTest::setup();

	let fake_admin = Address::generate(&env);
    let owner = Address::generate(&env);

    contract
        .mock_auths(&[MockAuth {
            address: &fake_admin ,
            invoke: &MockAuthInvoke {
                contract: &contract.address.clone(),
                fn_name: "remove_car",
                args: (owner.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]).remove_car(&owner);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
pub fn test_remove_car_not_found_fails() {
    let ContractTest { env, contract, .. } = ContractTest::setup();
    let owner = Address::generate(&env);

    env.mock_all_auths();    
    contract.remove_car(&owner);
}