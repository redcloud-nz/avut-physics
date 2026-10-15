import type { Ratings } from "./ute-load-solver";

/**
 * A dual-cab 4WD ute's published figures. Masses are kg, lengths metres. `estimated` lists the figures that
 * aren't from the maker or a published test, and are worked out or assumed instead.
 */
export type Ute = Ratings & {
    key: string;
    label: string;
    /** The variant the figures are for. */
    variant: string;
    /** Empty, with all fluids and about 10 L of fuel, as on a compliance plate. */
    tare: number;
    fuelTank: number;
    /** The share of the empty ute's mass on its front axle. */
    unladenFrontShare: number;
    wheelbase: number;
    frontOverhang: number;
    rearOverhang: number;
    /** The tub's floor, inside. */
    tubLength: number;
    estimated: (keyof Ute)[];
    sources: { label: string; url: string }[];
};

/**
 * The utes to choose from. Figures are from spec listings by CarExpert, carsales (Redbook) and the makers, which
 * mostly give Australian figures; New Zealand's are the same where both were found. No maker publishes how an
 * empty ute's weight splits between its axles, so every split is an estimate: 58% on the front for a diesel dual
 * cab, a little less for the Shark's battery under the floor. Where only the kerb mass (full tank) was published,
 * the tare is worked back from it.
 */
export const UTES: Ute[] = [
    {
        key: "hilux",
        label: "Toyota Hilux (2026)",
        variant:
            "2026 Hilux SR5 2.8 diesel auto 4x4 double cab pick-up. Axle ratings and overhangs are for the manual",
        tare: 2096,
        fuelTank: 80,
        gvm: 3120,
        gcm: 6300,
        frontAxle: 1490,
        rearAxle: 1700,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.085,
        frontOverhang: 0.99,
        rearOverhang: 1.24,
        tubLength: 1.525,
        estimated: ["tare", "towBall", "unladenFrontShare", "tubLength"],
        sources: [
            {
                label: "carsales: 2026 Hilux SR5",
                url: "https://www.carsales.com.au/research/toyota/hilux/2026/sr5/",
            },
            { label: "Toyota NZ: Hilux", url: "https://www.toyota.co.nz/hilux" },
        ],
    },
    {
        key: "ranger",
        label: "Ford Ranger (2025)",
        variant: "2025 Ranger XLT 3.0 V6 auto 4x4 double cab pick-up",
        tare: 2174,
        fuelTank: 80,
        gvm: 3280,
        gcm: 6400,
        frontAxle: 1490,
        rearAxle: 1959,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.27,
        frontOverhang: 0.885,
        rearOverhang: 1.215,
        tubLength: 1.464,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert: 2025 Ranger XLT 3.0",
                url: "https://www.carexpert.com.au/ford/ranger/2025-xlt-3l-utility-4x4-diesel-automatic-jgfa8oga20250910",
            },
        ],
    },
    {
        key: "triton",
        label: "Mitsubishi Triton (2024)",
        variant: "2024 Triton VRX 2.4 auto 4x4 double cab pick-up (NZ)",
        tare: 2070,
        fuelTank: 75,
        gvm: 3200,
        gcm: 6250,
        frontAxle: 1580,
        rearAxle: 2040,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.13,
        frontOverhang: 0.89,
        rearOverhang: 1.3,
        tubLength: 1.52,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert NZ: 2024 Triton VRX",
                url: "https://www.carexpert.co.nz/mitsubishi/triton/2024-vrx-2-4l-pickup-4x4-diesel-automatic-joomf5fo20231122",
            },
        ],
    },
    {
        key: "navara",
        label: "Nissan Navara (2026)",
        variant: "2026 Navara ST-X 2.4 auto 4x4 double cab pick-up (NZ), built on the Triton",
        tare: 2070,
        fuelTank: 75,
        gvm: 3190,
        gcm: 6250,
        frontAxle: 1580,
        rearAxle: 2040,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.13,
        frontOverhang: 0.89,
        rearOverhang: 1.3,
        tubLength: 1.555,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert NZ: 2026 Navara ST-X",
                url: "https://www.carexpert.co.nz/nissan/navara/2026-st-x-2-4l-pickup-4x4-diesel-automatic-jooos5mo20260401",
            },
        ],
    },
    {
        key: "navara-d23",
        label: "Nissan Navara D23 (2025)",
        variant:
            "2025 Navara D23 ST-X 2.3 auto 4x4 double cab pick-up (NZ), the model before the Triton-based one",
        tare: 2083,
        fuelTank: 80,
        gvm: 3150,
        gcm: 5910,
        frontAxle: 1490,
        rearAxle: 1850,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.15,
        frontOverhang: 0.87,
        rearOverhang: 1.235,
        tubLength: 1.509,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert NZ: 2025 Navara ST-X",
                url: "https://www.carexpert.co.nz/nissan/navara/2025-st-x-2-3l-pickup-4x4-diesel-automatic-jooos5mo20250801",
            },
        ],
    },
    {
        key: "dmax",
        label: "Isuzu D-Max (2025)",
        variant: "2025 D-Max LS-U 3.0 auto 4x4 crew cab ute",
        tare: 2049,
        fuelTank: 76,
        gvm: 3100,
        gcm: 6000,
        frontAxle: 1450,
        rearAxle: 1910,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.125,
        frontOverhang: 0.905,
        rearOverhang: 1.255,
        tubLength: 1.57,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert: 2025 D-Max LS-U",
                url: "https://www.carexpert.com.au/isuzu/d-max/2025-ls-u-3l-utility-4x4-diesel-automatic-joksogw520250925",
            },
        ],
    },
    {
        key: "bt50",
        label: "Mazda BT-50 (2025)",
        variant: "2025 BT-50 GT 3.0 auto 4x4 dual cab ute (Australian figures)",
        tare: 2046,
        fuelTank: 76,
        gvm: 3100,
        gcm: 6000,
        frontAxle: 1450,
        rearAxle: 1910,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.125,
        frontOverhang: 0.905,
        rearOverhang: 1.25,
        tubLength: 1.571,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "CarExpert: 2025 BT-50 GT",
                url: "https://www.carexpert.com.au/mazda/bt-50/2025-gt-3l-utility-4x4-diesel-automatic-jo5kgfo520250129",
            },
        ],
    },
    {
        key: "amarok",
        label: "Volkswagen Amarok (2026)",
        variant:
            "2026 Amarok Style V6 3.0 auto 4x4 double cab. Sources differ on its mass by up to 50 kg",
        tare: 2320,
        fuelTank: 80,
        gvm: 3350,
        gcm: 6400,
        frontAxle: 1490,
        rearAxle: 1959,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.27,
        frontOverhang: 0.865,
        rearOverhang: 1.215,
        tubLength: 1.65,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "carsales: 2026 Amarok Style",
                url: "https://www.carsales.com.au/research/volkswagen/amarok/2026/tdi600-style/1af8784e-0c6d-46e3-9520-ee6e4b21759f/",
            },
            {
                label: "Autotrader NZ: Amarok Style V6 review",
                url: "https://autotrader.co.nz/car-reviews/2026-volkswagen-amarok-style-v6-review",
            },
        ],
    },
    {
        key: "cannon",
        label: "GWM Cannon (2025)",
        variant:
            "2025 Cannon Ultra 2.4 auto 4x4 dual cab pick-up (NZ). Only the overhangs' total is published",
        tare: 2173,
        fuelTank: 78,
        gvm: 3225,
        gcm: 6200,
        frontAxle: 1500,
        rearAxle: 1950,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.23,
        frontOverhang: 0.9,
        rearOverhang: 1.28,
        tubLength: 1.52,
        estimated: ["unladenFrontShare", "frontOverhang", "rearOverhang"],
        sources: [
            {
                label: "CarExpert NZ: 2025 Cannon Ultra",
                url: "https://www.carexpert.co.nz/gwm/cannon/2025-ultra-2-4l-pickup-4x4-diesel-automatic-jsgwfwfg20250801",
            },
        ],
    },
    {
        key: "t60",
        label: "LDV T60 Max (2025)",
        variant:
            "2025 T60 Max Pro auto 4x4 dual cab (Australian figures; NZ models may be rated to tow 3000 kg)",
        tare: 2064,
        fuelTank: 73,
        gvm: 3150,
        gcm: 6250,
        frontAxle: 1360,
        rearAxle: 1850,
        towing: 3500,
        towBall: 250,
        unladenFrontShare: 0.58,
        wheelbase: 3.155,
        frontOverhang: 0.942,
        rearOverhang: 1.268,
        tubLength: 1.525,
        estimated: ["unladenFrontShare"],
        sources: [
            {
                label: "carsales: 2025 T60 Max Pro",
                url: "https://www.carsales.com.au/research/ldv/t60/2025/max-pro/",
            },
        ],
    },
    {
        key: "shark6",
        label: "BYD Shark 6 (2025)",
        variant:
            "2025 Shark 6 Premium plug-in hybrid dual cab (Australian figures). Its published axle figures add up exactly to its GVM, so may be a split of it rather than ratings",
        tare: 2675,
        fuelTank: 60,
        gvm: 3500,
        gcm: 5750,
        frontAxle: 1607,
        rearAxle: 1893,
        towing: 2500,
        towBall: 250,
        unladenFrontShare: 0.55,
        wheelbase: 3.26,
        frontOverhang: 0.927,
        rearOverhang: 1.27,
        tubLength: 1.5,
        estimated: ["unladenFrontShare", "frontAxle", "rearAxle"],
        sources: [
            {
                label: "carsales: 2025 Shark 6 Premium",
                url: "https://www.carsales.com.au/research/byd/shark-6/2025/premium/",
            },
        ],
    },
    {
        key: "lc79",
        label: "Toyota Land Cruiser 79 (2025)",
        variant:
            "2025 Land Cruiser 79 GXL 2.8 auto double cab chassis (Australian figures), with an alloy tray of about 170 kg counted in its tare",
        tare: 2254,
        fuelTank: 130,
        gvm: 3510,
        gcm: 7010,
        frontAxle: 1540,
        rearAxle: 2050,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.18,
        frontOverhang: 0.85,
        rearOverhang: 1.205,
        tubLength: 1.8,
        estimated: [
            "tare",
            "unladenFrontShare",
            "frontAxle",
            "rearAxle",
            "rearOverhang",
            "tubLength",
        ],
        sources: [
            {
                label: "carsales: 2025 Land Cruiser 79 GXL",
                url: "https://www.carsales.com.au/research/toyota/landcruiser/2025/gxl/6fdf256c-287d-46a0-8408-35204f0d57ba/",
            },
            {
                label: "CarExpert: Land Cruiser 79 double cab review",
                url: "https://www.carexpert.com.au/car-reviews/2026-toyota-landcruiser-79-series-gxl-double-cab-review",
            },
        ],
    },
    {
        key: "colorado",
        label: "Holden Colorado RG (2017)",
        variant:
            "2017 Colorado LT 2.8 diesel auto 4x4 crew cab pick-up. Only the overhangs' total is published",
        tare: 2047,
        fuelTank: 76,
        gvm: 3150,
        gcm: 6000,
        frontAxle: 1450,
        rearAxle: 1850,
        towing: 3500,
        towBall: 350,
        unladenFrontShare: 0.58,
        wheelbase: 3.096,
        frontOverhang: 0.88,
        rearOverhang: 1.385,
        tubLength: 1.484,
        estimated: ["unladenFrontShare", "frontOverhang", "rearOverhang"],
        sources: [
            {
                label: "carsales: 2017 Colorado LT",
                url: "https://www.carsales.com.au/research/holden/colorado/2017/lt/c14533dd-7bee-4ec0-af07-6c57d7664671/",
            },
        ],
    },
];

export const uteFor = (key: string) => UTES.find((u) => u.key === key) ?? UTES[0];
