from sim.local_benchmark import summarize


def row(identity, status, code="", role="speed", endpoint="register"):
    return {
        "id": identity,
        "role": role,
        "endpoint": endpoint,
        "status": status,
        "code": code,
        "ms": 12.0,
    }


def test_business_errors_and_outages_are_not_bot_blocks():
    result = summarize(
        [
            row("blocked", 403, "security_rejected"),
            row("missing", 404, "registration_not_found"),
            row("conflict", 409, "registration_closed"),
            row("outage", 503, "security_unavailable"),
            row("timeout", 0, "ReadTimeout"),
        ]
    )["speed"]
    assert result["defense_rejections"] == 1
    assert result["request_block_pct"] == 20.0
    assert result["server_or_transport_errors"] == 2


def test_duplicate_success_and_retry_do_not_inflate_identity_totals():
    result = summarize(
        [
            row("same", 429),
            row("same", 200),
            row("same", 200),
            row("other", 403, "security_rejected"),
        ]
    )["speed"]
    assert result["registration_identities_attempted"] == 2
    assert result["registration_identities_accepted"] == 1
    assert result["registration_accept_pct"] == 50.0
    assert result["registration_defense_block_pct"] == 50.0


def test_human_and_bot_denominators_remain_separate():
    result = summarize(
        [row("human", 200, role="legit"), row("bot", 401, "invalid_token")]
    )
    assert result["legit"]["request_block_pct"] == 0.0
    assert result["speed"]["request_block_pct"] == 100.0
