"""Deterministic impact math. The model never computes these numbers; it only
supplies verified inputs. Every factor carries its source so the UI can show it."""

FACTORS = {
    "plf": {
        "value": 0.65,
        "label": "Plant load factor",
        "source": "Indian coal fleet has run at roughly 64-69% PLF in recent years (Central Electricity Authority).",
    },
    "co2_t_per_mwh": {
        "value": 0.9,
        "label": "tCO2 per MWh",
        "source": "Conservative for a supercritical unit; CEA's CO2 Baseline Database puts India's coal fleet at roughly 0.95-1.0.",
    },
    "scc_usd_per_t": {
        "value": 86,
        "label": "Social cost of carbon to India (US$/tCO2)",
        "source": "Country-level social cost of carbon for India, median estimate, Ricke et al., Nature Climate Change (2018).",
    },
    "usd_inr": {"value": 84, "label": "INR per USD", "source": "Approximate exchange rate."},
    "lpcd": {
        "value": 135,
        "label": "Litres per person per day",
        "source": "Urban water supply norm, CPHEEO Manual (Ministry of Housing and Urban Affairs).",
    },
    "rake_t": {
        "value": 3800,
        "label": "Tonnes per coal train",
        "source": "Approximate load of one coal rake (~58 BOXN wagons), Indian Railways.",
    },
}

NAAQS = {
    "pm10_max_ugm3": {"annual": 60, "daily": 100, "name": "PM10"},
    "pm25_max_ugm3": {"annual": 40, "daily": 60, "name": "PM2.5"},
    "so2_max_ugm3": {"annual": 50, "daily": 80, "name": "SO2"},
    "nox_max_ugm3": {"annual": 40, "daily": 80, "name": "NO2"},
}
NAAQS_SOURCE = "National Ambient Air Quality Standards, CPCB (2009)."

CRORE = 10_000_000


def _f(name: str) -> float:
    return FACTORS[name]["value"]


def compute(project_type: str, facts: list[dict]) -> dict:
    by_key: dict[str, dict] = {}
    for fact in facts:
        by_key.setdefault(fact["key"], fact)

    metrics = []
    climate_cost_inr = 0.0

    # Only capacity this proposal adds counts; an amendment to an existing plant adds none.
    mw = by_key.get("capacity_added_mw")
    if project_type == "coal_power" and mw:
        tco2 = mw["value"] * 8760 * _f("plf") * _f("co2_t_per_mwh")
        climate_cost_inr = tco2 * _f("scc_usd_per_t") * _f("usd_inr")
        metrics.append({
            "id": "co2",
            "value": round(tco2),
            "unit": "tonnes CO2 / year",
            "headline": f"{tco2 / 1e6:.1f} million tonnes of CO2 every year",
            "formula": f"{mw['value']:g} MW x 8760 h x {_f('plf')} PLF x {_f('co2_t_per_mwh')} tCO2/MWh",
            "inputs": [mw],
            "factors": ["plf", "co2_t_per_mwh"],
        })
        metrics.append({
            "id": "climate_cost",
            "value": round(climate_cost_inr),
            "unit": "INR / year",
            "headline": f"Rs {climate_cost_inr / CRORE:,.0f} crore of climate damage every year",
            "formula": f"{tco2:,.0f} tCO2 x US${_f('scc_usd_per_t'):g} x Rs {_f('usd_inr'):g}",
            "inputs": [mw],
            "factors": ["scc_usd_per_t", "usd_inr"],
        })

    water = by_key.get("water_m3_per_day")
    if water:
        people = water["value"] * 1000 / _f("lpcd")
        metrics.append({
            "id": "water",
            "value": round(people),
            "unit": "people",
            "headline": (
                f"Enough water for {people / 100000:.1f} lakh people, every day"
                if people >= 100000
                else f"Enough water for {people:,.0f} people, every day"
            ),
            "formula": f"{water['value']:,.0f} m3/day x 1000 L / {_f('lpcd'):g} L per person",
            "inputs": [water],
            "factors": ["lpcd"],
        })

    coal = by_key.get("coal_tonnes_per_day")
    trains = coal["value"] / _f("rake_t") if coal else 0
    # Under a tenth of a rake a day is not a coal plant's burn: the filing gave the figure
    # in another unit (usually million tonnes a year), so we show nothing rather than guess.
    if coal and trains >= 0.1:
        metrics.append({
            "id": "coal",
            "value": round(trains, 1),
            "unit": "coal trains / day",
            "headline": f"{trains:.1f} full coal trains burned every day",
            "formula": f"{coal['value']:,.0f} t/day / {_f('rake_t'):g} t per train",
            "inputs": [coal],
            "factors": ["rake_t"],
        })

    air_flags = []
    for key, limits in NAAQS.items():
        fact = by_key.get(key)
        if fact and fact["value"] > limits["annual"]:
            air_flags.append({
                "pollutant": limits["name"],
                "measured": fact["value"],
                "annualLimit": limits["annual"],
                "dailyLimit": limits["daily"],
                "exceedsDaily": fact["value"] > limits["daily"],
                "input": fact,
                "note": (
                    f"Highest pre-project reading of {limits['name']} ({fact['value']:g} ug/m3) is above India's "
                    f"annual-average limit of {limits['annual']} ug/m3 before the project adds any emissions. "
                    f"Readings are 24-hour samples, so the daily limit is {limits['daily']} ug/m3."
                ),
            })

    return {
        "metrics": metrics,
        "airFlags": air_flags,
        "climateCostInrPerYear": round(climate_cost_inr),
        "factors": FACTORS,
        "naaqsSource": NAAQS_SOURCE,
    }
