use soroban_sdk::{vec, Symbol, IntoVal};
use crate::tests::config::{contract::ContractTest, utils::get_contract_events};

#[test]
pub fn test_initialize() {
    let ContractTest { env, contract, admin, token, .. } = ContractTest::setup();
    let contract_events = get_contract_events(&env, &contract.address);
    
    assert_eq!(
        contract_events,
        vec![
            &env,
            (
                contract.address.clone(),
                vec![
                    &env,
                    *Symbol::new(&env, "contract_initialized").as_val(),
                ],
                (admin.clone(), token.0.address.clone()).into_val(&env)
            )
        ]
    );
}