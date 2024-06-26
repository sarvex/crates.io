use crate::builders::CrateBuilder;
use crate::util::{RequestHelper, TestApp};
use insta::assert_yaml_snapshot;
use serde_json::Value;

#[test]
fn authors() {
    let (app, anon, user) = TestApp::init().with_user();
    let user = user.as_model();

    app.db(|conn| {
        CrateBuilder::new("foo_authors", user.id)
            .version("1.0.0")
            .expect_build(conn);
    });

    let json: Value = anon.get("/api/v1/crates/foo_authors/1.0.0/authors").good();
    let json = json.as_object().unwrap();
    assert_yaml_snapshot!(json);
}
