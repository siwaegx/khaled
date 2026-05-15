"""
RO System Design Engine — rule-based, no AI dependencies.

All flow values are in m3/day unless noted.
Pressure in bar, power in kW and HP.
"""

import math
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Rule tables
# ---------------------------------------------------------------------------

@dataclass
class _WaterClass:
    label: str
    membrane_model: str
    membrane_capacity_m3d: float   # permeate per element at rated pressure
    recovery: float                 # fraction (0–1)
    pressure_bar: float
    max_tds: int


_WATER_CLASSES: list[_WaterClass] = [
    _WaterClass("Ultra-low TDS",    "BW30-400",  1.8, 0.80,  4.0,   500),
    _WaterClass("Brackish Low",     "BW30-400",  1.6, 0.78,  7.0,  2000),
    _WaterClass("Brackish Medium",  "BW30-365",  1.4, 0.75, 10.0,  5000),
    _WaterClass("Brackish High",    "BW30-365",  1.2, 0.70, 14.0, 10000),
    _WaterClass("Seawater",         "SW30-380",  0.9, 0.45, 55.0, 35000),
    _WaterClass("High-Salinity SW", "SW30-380",  0.7, 0.40, 70.0, 99999),
]

_PUMP_EFFICIENCY = 0.75   # combined pump + motor
_ELEMENTS_PER_VESSEL = 6


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

@dataclass
class RODesignResult:
    # inputs echoed back
    flow_rate_m3d: float
    tds_ppm: int

    # water classification
    water_class: str
    membrane_model: str

    # membrane train
    membrane_count: int
    vessels: int
    elements_per_vessel: int
    recovery_pct: float

    # hydraulics
    feed_flow_m3d: float
    operating_pressure_bar: float

    # pump
    pump_kw: float
    pump_hp: float

    # advisory notes
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "inputs": {
                "flow_rate_m3d": self.flow_rate_m3d,
                "tds_ppm": self.tds_ppm,
            },
            "water_classification": self.water_class,
            "membranes": {
                "model": self.membrane_model,
                "total_elements": self.membrane_count,
                "pressure_vessels": self.vessels,
                "elements_per_vessel": self.elements_per_vessel,
            },
            "hydraulics": {
                "feed_flow_m3d": self.feed_flow_m3d,
                "product_flow_m3d": self.flow_rate_m3d,
                "recovery_pct": self.recovery_pct,
                "operating_pressure_bar": self.operating_pressure_bar,
            },
            "pump": {
                "duty_kw": self.pump_kw,
                "duty_hp": self.pump_hp,
            },
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# Design function
# ---------------------------------------------------------------------------

def design_ro_system(flow_rate: float, tds: int) -> RODesignResult:
    """
    Produce a rule-based RO system design.

    Args:
        flow_rate: Required product water, m3/day.
        tds:       Feed water TDS, ppm.

    Returns:
        RODesignResult with all sizing details.
    """
    if flow_rate <= 0:
        raise ValueError("flow_rate must be > 0")
    if tds < 0:
        raise ValueError("tds must be >= 0")

    wc = next((c for c in _WATER_CLASSES if tds <= c.max_tds), _WATER_CLASSES[-1])

    feed_flow = flow_rate / wc.recovery
    elements_needed = math.ceil(feed_flow / wc.membrane_capacity_m3d)
    vessels = math.ceil(elements_needed / _ELEMENTS_PER_VESSEL)
    total_elements = vessels * _ELEMENTS_PER_VESSEL

    # Pump sizing: power = (feed_flow_m3/s × pressure_Pa) / efficiency
    feed_m3s = feed_flow / 86400
    pressure_pa = wc.pressure_bar * 1e5
    pump_kw = round((feed_m3s * pressure_pa) / (_PUMP_EFFICIENCY * 1000), 2)
    pump_hp = round(pump_kw * 1.341, 2)

    notes: list[str] = []
    if tds > 10000:
        notes.append("Seawater feed — consider energy recovery device (ERD) to cut power by 30–40%.")
    if flow_rate > 500:
        notes.append("Large system — consider multi-pass or split-partial configuration.")
    if wc.recovery < 0.50:
        notes.append(f"Recovery is {int(wc.recovery*100)}% — brine disposal plan required.")
    if tds > 500:
        notes.append("Anti-scalant dosing and 5 µm cartridge pre-filter recommended.")

    return RODesignResult(
        flow_rate_m3d=round(flow_rate, 2),
        tds_ppm=tds,
        water_class=wc.label,
        membrane_model=wc.membrane_model,
        membrane_count=total_elements,
        vessels=vessels,
        elements_per_vessel=_ELEMENTS_PER_VESSEL,
        recovery_pct=round(wc.recovery * 100, 1),
        feed_flow_m3d=round(feed_flow, 2),
        operating_pressure_bar=wc.pressure_bar,
        pump_kw=pump_kw,
        pump_hp=pump_hp,
        notes=notes,
    )
