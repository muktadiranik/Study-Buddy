"""Build 520 deterministic classroom study sets, without an API or third-party data.

Run from the project root: python scripts/seed_library.py
These are authored example notes, not AI output or simulated student activity.
"""

import json
from fractions import Fraction
from math import pi
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / "src" / "data" / "study-sets.json"
SEED_VERSION = 1


def number(value: float) -> str:
    return f"{value:,.2f}".rstrip("0").rstrip(".")


def example(topic: str, subject: str, title: str, *paragraphs: str) -> dict:
    return {"topic": topic, "subject": subject, "title": title, "notes": "\n\n".join(paragraphs)}


def lessons(i: int) -> list[dict]:
    """Each template teaches a different concept through a fully worked example."""
    records = []
    a, b, x = 2 + i % 5, 3 + i, 2 + i
    c = a * x + b
    records.append(
        example(
            "linear-equations",
            "Algebra",
            f"Linear equations: solve {a}x + {b} = {c}",
            "A linear equation has a variable raised to the first power. To solve it, isolate the "
            "variable by doing the same operation to both sides of the equation.",
            f"Worked classroom example: {a}x + {b} = {c}. Subtract {b} from both sides to get "
            f"{a}x = {c - b}. Divide both sides by {a}, so x = {x}.",
            f"Check the answer by substitution: {a} × {x} + {b} = {c}. "
            "The original equation is true.",
            "Subtract the constant before dividing. Dividing only one term on one side changes the "
            "equation and does not preserve equality.",
        )
    )
    x, y = i + 8, i % 5 + 2
    total, difference = x + y, x - y
    records.append(
        example(
            "simultaneous-equations",
            "Algebra",
            f"Simultaneous equations: x + y = {total}, x − y = {difference}",
            "A solution to simultaneous equations must satisfy both equations at the same time. "
            "Elimination removes one variable by adding or subtracting the equations.",
            f"Worked example: x + y = {total} and x − y = {difference}. Adding the equations "
            f"gives 2x = {total + difference}, so x = {x}.",
            f"Substitute x into the first equation: {x} + y = {total}. Therefore y = {y}. "
            f"Check the second equation: {x} − {y} = {difference}.",
            "The +y and −y terms cancel when the equations are added. Keep track of signs when "
            "choosing whether to add or subtract.",
        )
    )
    a, b = i + 1, i + 4
    records.append(
        example(
            "quadratic-factorisation",
            "Algebra",
            f"Quadratic roots: x² − {a + b}x + {a * b} = 0",
            "A quadratic equation includes a squared variable. Factoring rewrites a quadratic as "
            "a product of two linear expressions. If a product is zero, "
            "at least one factor is zero.",
            f"Worked example: x² − {a + b}x + {a * b} = 0. The numbers {a} and {b} add to "
            f"{a + b} and multiply to {a * b}, so the factors are (x − {a})(x − {b}).",
            f"Set each factor equal to zero. x − {a} = 0 gives x = {a}; x − {b} = 0 gives x = {b}.",
            "Expanding the factors checks the middle term and the constant. Remember that a "
            "quadratic can have two roots; finding one is not always enough.",
        )
    )
    first, step, n = i + 2, 2 + i % 5, 10 + i
    term = first + (n - 1) * step
    records.append(
        example(
            "arithmetic-sequences",
            "Algebra",
            f"Arithmetic sequences: term {n} with a difference of {step}",
            "An arithmetic sequence increases or decreases by the same amount each time. Its nth "
            "term is aₙ = a₁ + (n − 1)d, where a₁ is the first term "
            "and d is the common difference.",
            f"Worked example: the sequence starts {first}, {first + step}, {first + 2 * step}. "
            f"Here a₁ = {first} and d = {step}. Find term {n}.",
            f"There are {n - 1} steps from the first term to term {n}. Therefore aₙ = "
            f"{first} + {n - 1} × {step} = {term}.",
            "Use n − 1 differences, not n differences: the first term already counts as term 1.",
        )
    )
    first, ratio, n = 2 + i, 2 + i % 2, 3 + i % 4
    term = first * ratio ** (n - 1)
    records.append(
        example(
            "geometric-sequences",
            "Algebra",
            f"Geometric sequences: start {first}, ratio {ratio}, term {n}",
            "A geometric sequence multiplies each term by a constant ratio. Its nth term is "
            "aₙ = a₁ × r^(n − 1), where r is the common ratio.",
            f"Worked example: the sequence begins {first}, {first * ratio}, {first * ratio**2}. "
            f"The first term is {first} and the ratio is {ratio}.",
            f"Term {n} is {first} × {ratio}^{n - 1} = {term}. Multiplication is repeated "
            f"{n - 1} times after the first term.",
            "A constant difference makes a sequence arithmetic; a constant multiplication ratio "
            "makes it geometric. These are different patterns.",
        )
    )
    width, height = 3 + i, 2 + i % 7
    records.append(
        example(
            "rectangle-measurements",
            "Geometry",
            f"Rectangles: a {width} cm by {height} cm notebook cover",
            "A rectangle has four right angles. Area measures the space inside a shape; perimeter "
            "measures the distance around its edge. Area = width × height; "
            "perimeter = 2(width + height).",
            f"Illustrative classroom example: a notebook cover is {width} cm wide and {height} cm "
            f"high. Its area is {width} × {height} = {width * height} cm².",
            f"The perimeter is 2 × ({width} + {height}) = {2 * (width + height)} cm. "
            "The two calculations answer different measurement questions.",
            "Use square units for area and linear units for perimeter. Do not add the side lengths "
            "when calculating area.",
        )
    )
    base, height = 8 + 2 * i, 3 + i
    records.append(
        example(
            "triangle-area",
            "Geometry",
            f"Triangle area: base {base} m and height {height} m",
            "The area of a triangle is one half of base × perpendicular height. The perpendicular "
            "height meets the base, or its extension, at a right angle.",
            f"Illustrative classroom example: a triangular garden has base {base} m and "
            f"perpendicular height {height} m. "
            f"Area = ½ × {base} × {height} = {base * height // 2} m².",
            "Two identical copies of this triangle can form a parallelogram with the same base and "
            "height. This explains the factor of one half.",
            "A sloping side is not automatically the height. The area formula needs the distance "
            "measured perpendicular to the base.",
        )
    )
    radius = i + 2
    records.append(
        example(
            "circle-measurements",
            "Geometry",
            f"Circles: radius {radius} cm, area and circumference",
            "A circle's radius is the distance from its centre to its edge. Its diameter is twice "
            "the radius. Circumference = 2πr and area = πr².",
            f"Worked example: a circle has radius {radius} cm and diameter {2 * radius} cm. "
            f"Its circumference is {2 * radius}π cm, approximately {2 * pi * radius:.2f} cm.",
            f"Its area is {radius**2}π cm², approximately {pi * radius**2:.2f} cm². "
            "The decimal results use π and are rounded to two decimal places.",
            "Square the radius when calculating area. Using the diameter as the radius makes the "
            "calculation too large.",
        )
    )
    a, b, c = 3 * i, 4 * i, 5 * i
    records.append(
        example(
            "pythagoras",
            "Geometry",
            f"Pythagoras: right-triangle legs {a} cm and {b} cm",
            "For a right-angled triangle, a² + b² = c². The hypotenuse c is opposite the right "
            "angle and is the longest side. This theorem requires a right angle.",
            f"Worked example: the perpendicular sides are {a} cm and {b} cm. Their squares sum "
            f"to {a**2} + {b**2} = {c**2} cm².",
            f"Taking the positive square root gives a hypotenuse of {c} cm. This triangle is a "
            f"scaled 3–4–5 right triangle with scale factor {i}.",
            "The sum of the two shorter side lengths is not the hypotenuse. Add their squares "
            "and then take the square root.",
        )
    )
    price, rate = 100 + 20 * i, 5 + i
    discount = price * rate / 100
    records.append(
        example(
            "percentage-discounts",
            "Arithmetic",
            f"Percentages: {rate}% off a {price}-unit price",
            "Percent means per hundred. To find p% of a quantity, multiply the quantity by p/100. "
            "A discount reduces the original price by that amount.",
            f"Illustrative classroom example: a textbook costs {price} currency units and has a "
            f"{rate}% discount. The discount is {price} × {rate}/100 = {number(discount)} units.",
            f"The sale price is {price} − {number(discount)} = {number(price - discount)} units. "
            f"Equivalently, multiply the original price by {100 - rate}/100.",
            "Use the original price as the base for this percentage. The discount amount and the "
            "final price are different quantities.",
        )
    )
    left, right, unit = 2 + i % 4, 3 + i % 5, 10 + i
    total = (left + right) * unit
    records.append(
        example(
            "ratio-sharing",
            "Arithmetic",
            f"Sharing {total} tokens in the ratio {left}:{right}",
            "A ratio compares quantities in parts. When a total is shared in a ratio a:b, first "
            "add a and b to find the number of equal parts.",
            f"Worked example: share {total} tokens in the ratio {left}:{right}. There are "
            f"{left + right} parts altogether, so one part is "
            f"{total} ÷ {left + right} = {unit} tokens.",
            f"The shares are {left} × {unit} = {left * unit} tokens and {right} × {unit} = "
            f"{right * unit} tokens. They add back to {total} tokens.",
            "Do not divide the total by just one ratio number. A share must represent its fraction "
            "of all the parts combined.",
        )
    )
    d1, d2 = i + 2, i + 3
    result = Fraction(1, d1) + Fraction(1, d2)
    records.append(
        example(
            "adding-fractions",
            "Arithmetic",
            f"Adding fractions: 1/{d1} + 1/{d2}",
            "To add fractions, express them with a common denominator. The denominator tells us "
            "the size of each part; the numerator counts how many parts are present.",
            f"Worked example: 1/{d1} + 1/{d2}. A common denominator is {d1 * d2}. Rewrite the "
            f"fractions as {d2}/{d1 * d2} and {d1}/{d1 * d2}.",
            f"Add the numerators: ({d2} + {d1})/{d1 * d2} = {d1 + d2}/{d1 * d2}. "
            f"In simplest form, the answer is {result.numerator}/{result.denominator}.",
            "Do not add the denominators. The fractions must use equally sized parts before their "
            "numerators can be combined.",
        )
    )
    values = [i + 4, i + 7, i + 9, i + 11, i + 14]
    records.append(
        example(
            "arithmetic-mean",
            "Statistics",
            f"Mean study time: five sessions starting at {values[0]} minutes",
            "The arithmetic mean is the sum of all observations divided by the number of "
            "observations. It uses every value in the data set.",
            f"Illustrative classroom data: five study sessions last {', '.join(map(str, values))} "
            f"minutes. The total study time is {sum(values)} minutes.",
            f"There are five sessions. The mean is {sum(values)} ÷ 5 = {number(sum(values) / 5)} "
            "minutes per session. The mean need not equal an individual observation.",
            "Count all observations, including repeated values. An unusually large or small value "
            "can pull the mean toward it.",
        )
    )
    ordered = [i + 3, i + 5, i + 8, i + 10, i + 12]
    shuffled = [ordered[j] for j in (3, 0, 4, 1, 2)]
    records.append(
        example(
            "median",
            "Statistics",
            f"Finding the median: a five-value data set around {ordered[2]}",
            "The median is the middle value after observations are put in order. For an odd "
            "number of observations, there is one middle position.",
            f"Worked example: the observations are {', '.join(map(str, shuffled))}. Sorting them "
            f"gives {', '.join(map(str, ordered))}.",
            "The middle of five observations is the third position, "
            f"so the median is {ordered[2]}. "
            "Two observations lie on either side of this position.",
            "Sort the data before choosing the middle position. The median is based on position, "
            "not on the order in which observations were collected.",
        )
    )
    red, blue = i + 4, 6 + i % 5
    probability = Fraction(red, red + blue)
    records.append(
        example(
            "simple-probability",
            "Statistics",
            f"Probability: drawing red from {red} red and {blue} blue counters",
            "When all outcomes are equally likely, probability is the number of favourable "
            "outcomes divided by the total number of possible outcomes.",
            f"Illustrative classroom example: a bag contains {red} red and {blue} blue counters. "
            "The counters are identical in size, and one is selected at random.",
            f"There are {red + blue} possible counters and {red} are red. P(red) = "
            f"{red}/{red + blue} = {probability.numerator}/{probability.denominator}, "
            "approximately "
            f"{red / (red + blue):.3f}.",
            "The denominator must include both colours. Probability is between zero and one; "
            "these results assume the random selection makes counters equally likely.",
        )
    )
    test, project = 50 + i, 70 + i
    weighted = test * 0.4 + project * 0.6
    records.append(
        example(
            "weighted-means",
            "Statistics",
            f"Weighted marks: a {test}% test and a {project}% project",
            "A weighted mean gives different observations different importance. Multiply each "
            "value by its weight and divide by the sum of the weights.",
            f"Illustrative grading example: a test mark is {test}% "
            f"and a project mark is {project}%. "
            "The test contributes 40% of the final mark and the project contributes 60%.",
            f"The weighted result is 0.40 × {test} + 0.60 × {project} = {number(weighted)}%. "
            "The weights sum to one, so no further division is needed in this form.",
            "Taking a simple average would treat the two components as equally important. That "
            "would ignore the specified 40:60 weighting.",
        )
    )
    speed, hours = 12 + i, 2 + i % 4
    distance = speed * hours
    records.append(
        example(
            "average-speed",
            "Physics",
            f"Average speed: {distance} km over {hours} hours",
            "Average speed is total distance travelled divided by total elapsed time. It measures "
            "how quickly distance accumulates and does not include a direction.",
            f"Illustrative classroom journey: a cyclist travels {distance} km in {hours} hours. "
            f"Average speed = {distance}/{hours} = {speed} km/h.",
            f"To convert km/h to m/s, divide by 3.6. This speed is approximately {speed / 3.6:.2f} "
            "m/s. Both units describe the same distance per time.",
            "Average speed does not mean the cyclist maintained that exact speed throughout. "
            "Include stops if they are part of the total elapsed journey time.",
        )
    )
    mass, acceleration = i + 2, 1 + i % 6
    force = mass * acceleration
    records.append(
        example(
            "newtons-second-law",
            "Physics",
            f"Newton's second law: accelerating a {mass} kg trolley",
            "For constant mass in an inertial frame, Newton's second law is F = ma. F is the net "
            "force, m is mass in kilograms, and a is acceleration in metres per second squared.",
            f"Illustrative classroom example: a trolley has mass {mass} kg and acceleration "
            f"{acceleration} m/s². The net force is {mass} × {acceleration} = {force} N.",
            f"A newton is one kg·m/s². Substituting the values gives "
            f"{force} kg·m/s², or {force} N. "
            "The net force and acceleration point in the same direction.",
            "Use the net force after combining all forces, not just one applied force. A balanced "
            "set of forces gives zero acceleration, which does not necessarily mean zero velocity.",
        )
    )
    resistance, current = i + 2, 1 + i % 4
    voltage = resistance * current
    records.append(
        example(
            "ohms-law",
            "Physics",
            f"Ohm's law: {voltage} V across a {resistance} Ω resistor",
            "For an ohmic conductor at constant physical conditions, voltage, current, and "
            "resistance are related by V = IR. Voltage is in volts, "
            "current in amperes, and resistance "
            "in ohms.",
            f"Illustrative ideal circuit: a {resistance} Ω resistor has {voltage} V across it. "
            f"Rearranging the equation gives I = V/R = {voltage}/{resistance} = {current} A.",
            f"Check by multiplying: {current} A × {resistance} Ω = {voltage} V. The calculation "
            "assumes the resistor's resistance remains constant.",
            "Current flows through the resistor; voltage is measured across it. Ohm's law in this "
            "constant-resistance form is not a universal description "
            "of every electrical component.",
        )
    )
    density, volume = 2 + i % 7, 10 + 5 * i
    mass = density * volume
    records.append(
        example(
            "density",
            "Physics",
            f"Density: {mass} g in a volume of {volume} cm³",
            "Density is mass per unit volume. The formula is ρ = m/V. A density calculation must "
            "use compatible units for mass and volume.",
            f"Illustrative classroom measurement: a uniform block has mass {mass} g and volume "
            f"{volume} cm³. Its density is {mass}/{volume} = {density} g/cm³.",
            f"Check by rearranging: mass = density × volume = {density} × {volume} = {mass} g. "
            "The example describes a hypothetical block rather than "
            "identifying a particular material.",
            "Do not divide volume by mass when finding density. A larger object can have the same "
            "density as a smaller object made from the same uniform material.",
        )
    )
    molar_mass, tenths = 40 + 2 * i, 10 + i
    moles = tenths / 10
    mass = molar_mass * tenths / 10
    records.append(
        example(
            "amount-of-substance",
            "Chemistry",
            f"Moles: {number(mass)} g with molar mass {molar_mass} g/mol",
            "The amount of substance in moles is n = m/M, where m is the sample mass and M is "
            "the molar mass. Using grams and grams per mole gives an answer in moles.",
            f"Illustrative classroom example: a pure sample has mass {number(mass)} g. The problem "
            f"gives its molar mass as {molar_mass} g/mol; "
            "it does not identify a specific compound.",
            f"The amount is {number(mass)} ÷ {molar_mass} = {number(moles)} mol. Check: "
            f"{number(moles)} mol × {molar_mass} g/mol = {number(mass)} g.",
            "Mass and amount of substance are different quantities. Always use the correct "
            "substance's molar mass and convert kilograms to grams if M is given in g/mol.",
        )
    )
    value = 16 + i
    binary = f"{value:08b}"
    powers = [str(2**power) for power in range(7, -1, -1) if value & 2**power]
    records.append(
        example(
            "binary-numbers",
            "Computer Science",
            f"Binary conversion: decimal {value} as an unsigned byte",
            "Binary is base two and uses digits zero and one. From right to left, an unsigned "
            "byte's place values are 1, 2, 4, 8, 16, 32, 64, and 128.",
            f"Worked example: decimal {value} is written as the eight-bit value {binary}. "
            f"The positions containing a one contribute {' + '.join(powers)} = {value}.",
            f"Leading zeroes keep the representation eight bits wide without changing its value. "
            f"Checking int('{binary}', 2) in Python also returns {value}.",
            "This is an unsigned interpretation. Signed representations have different rules for "
            "the most significant bit; do not apply unsigned place values blindly to signed data.",
        )
    )
    values = [10 * j + i for j in range(1, 9)]
    index = (i - 1) % len(values)
    target = values[index]
    records.append(
        example(
            "linear-search",
            "Computer Science",
            f"Linear search: find {target} in an eight-item list",
            "Linear search checks list items one at a time until it finds the target or reaches "
            "the end. A basic implementation starts at index zero and moves from left to right.",
            f"Worked example: search the list {values} for {target}. The target is at zero-based "
            f"index {index}, which is position {index + 1} when counting from one.",
            f"A left-to-right search makes {index + 1} equality comparisons before finding this "
            "target. The number of comparisons is one more than its zero-based index.",
            "The worst-case running time is O(n): a target at the end, or an absent target, may "
            "require checking every item. A best-case match at the first "
            "item takes one comparison.",
        )
    )
    kib = 20 + i
    size = kib * 1024
    records.append(
        example(
            "binary-storage-units",
            "Computer Science",
            f"Storage units: convert {kib} KiB to bytes and bits",
            "One kibibyte (KiB) is 1,024 bytes. One byte is eight bits. The binary prefix KiB is "
            "different from the decimal prefix kB, which means 1,000 bytes.",
            f"Worked example: a file is exactly {kib} KiB. Multiply by 1,024 to find its size: "
            f"{kib} × 1,024 = {size:,} bytes.",
            f"Convert bytes to bits by multiplying by eight: {size:,} × 8 = {size * 8:,} bits. "
            "These calculations describe the logical data size, "
            "ignoring filesystem allocation overhead.",
            "Check both the prefix and the symbol. A lowercase b commonly denotes bits; an "
            "uppercase B denotes bytes. Confusing the two introduces a factor-of-eight error.",
        )
    )
    principal, rate, years = 500 + 100 * i, 3 + i % 6, 1 + i % 4
    interest = principal * rate * years / 100
    records.append(
        example(
            "simple-interest",
            "Economics",
            f"Simple interest: {principal} units at {rate}% for {years} years",
            "In a simple-interest model, interest is calculated on the original principal only. "
            "The formula is I = Prt when r is the annual rate written "
            "as a decimal and t is in years.",
            f"Illustrative classroom example: P = {principal} currency units, annual rate = "
            f"{rate}%, and time = {years} years. Interest = {principal} × {rate}/100 × {years} "
            f"= {number(interest)} units.",
            f"The final amount in this simplified model is {principal} + {number(interest)} = "
            f"{number(principal + interest)} units. "
            "This hypothetical calculation excludes fees and taxes.",
            "Simple interest differs from compound interest: it does not add previous interest "
            "to the balance used to calculate future interest.",
        )
    )
    units, price, variable = 40 + 5 * i, 20 + i, 8 + i
    contribution = price - variable
    fixed = units * contribution
    records.append(
        example(
            "break-even-analysis",
            "Economics",
            f"Break-even analysis: fixed costs of {fixed} units",
            "In a basic break-even model, total revenue equals total cost at the break-even "
            "quantity. Contribution per unit is selling price minus variable cost per unit.",
            f"Illustrative classroom shop: fixed costs are {fixed} currency units, selling price "
            f"is {price} per item, and variable cost is {variable} per item. Contribution per item "
            f"is {price} − {variable} = {contribution} units.",
            f"Break-even quantity = fixed costs/contribution = {fixed}/{contribution} = {units} "
            f"items. Revenue is {units * price}; total cost is {fixed} + {units * variable} = "
            f"{fixed + units * variable}, so they match.",
            "This model assumes a constant selling price, constant variable cost per unit, and "
            "that every produced item is sold. It is a simplified classroom model.",
        )
    )
    return records


def build_records() -> list[dict]:
    """Stable IDs make repeat imports safe and allow students to edit seeded notes."""
    records = []
    for i in range(1, 21):
        for record in lessons(i):
            topic = record.pop("topic")
            records.append({"id": f"seed-v{SEED_VERSION}-{topic}-{i:02d}", **record})
    return records


def main():
    records = build_records()
    assert len(records) == 520
    assert len({record["id"] for record in records}) == len(records)
    assert len({record["title"] for record in records}) == len(records)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"seedVersion": SEED_VERSION, "records": records}, indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(records)} study sets across {len({r['subject'] for r in records})} subjects."
    )
    print(f"Seed file: {OUTPUT}")


if __name__ == "__main__":
    main()
