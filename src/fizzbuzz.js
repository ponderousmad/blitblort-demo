// FizzBuzz - but with some of the variants we played in our family:
// 'thirty' and 'fifty' become 'fizzty' and 'buzzty' repsectively
// and the last digit is fizz/buzzed also. so eg, 53 becomes fizzty three
// I then extended this to handle numbers up to the quadrillions,
// with the rule that for every three orders of magnitude (million, billion, etc.)
// you separately fizzbuz the corresponding triad, but otherwise it's the same as
// for english rules for speaking large numbers.
var FIZZBUZZ = (function () {
    "use strict";

    var logLevel = 0;
    const FIZZ = 3;
    const BUZZ = 5;

    const BASE = 10;
    const HECTO = BASE * BASE;

    const WORDS = [
        "zero",
        "one",
        "two",
        "fizz",
        "four",
        "buzz",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "fizzteen",
        "fourteen",
        "fizz-buzz",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen"
    ];

    const TENS = [
        "",
        WORDS[10],
        "twenty",
        "fizzty",
        "forty",
        "buzzty",
        "sixty",
        "seventy",
        "eighty",
        "ninety",
        "hundred"
    ];

    function fizzBuzzBasic(n) {
        const isFizz = (n % FIZZ) === 0;
        const isBuzz = (n % BUZZ) === 0;
        if (isFizz && isBuzz) {
            return WORDS[FIZZ * BUZZ];

        } else if (isFizz) {
            return WORDS[FIZZ];

        } else if (isBuzz) {
            return WORDS[BUZZ];

        }
        return n;
    }

    // called as helper only, for values in [1, 99]
    function dekaFizzBuzz(n, forceWord) {
        const tensDigit = Math.floor(n / BASE);
        const onesDigit = n % BASE;
        if (forceWord || onesDigit === FIZZ || tensDigit == FIZZ || onesDigit === BUZZ || tensDigit == BUZZ) {
            if (n < WORDS.length) {
                return WORDS[n];

            } else if (onesDigit === 0) {
                return TENS[tensDigit];
            }

            return TENS[tensDigit] + " " + WORDS[onesDigit];

        }
        return(n);
    }

    // called as helper only, for values in [100, 999]
    function hectoFizzBuzz(n) {
        const hectoDigit = Math.floor(n / HECTO);
        const remainder =  n % HECTO;
        const hundreds = WORDS[hectoDigit] + " " + TENS[10];
        if (remainder === 0) {
            return hundreds;
        }

        return hundreds + " and " + dekaFizzBuzz(remainder, true);
    }

    // Assumes negatives already handled by fizzBuzz itself.
    function fizzBuzzLarge(n, forceWord) {
        const MEGA = HECTO * BASE;
        if (n < HECTO)
        {
            return(dekaFizzBuzz(n, forceWord));

        } else if (n < MEGA) {
            return(hectoFizzBuzz(n));
        }

        var magnitude = MEGA;
        var order = 0;
        while (n > magnitude) {
            magnitude *= MEGA;
            ++order;
        }
        const ORDERS = [
            "",
            " thousand",
            " million",
            " billion",
            " trillion",
            " quadrilion"
        ];
        if (order >= ORDERS.length) {
            throw new RangeError("I can't count that high!");
        }

        var number = "";
        var remainder = n;
        while (remainder && order >= 0) {
            magnitude /= MEGA;
            const megaCount = Math.floor(remainder / magnitude);
            if (megaCount) {
                if (number) {
                    if (order === 0 && (remainder < HECTO || !Number.isInteger(fizzBuzzBasic(remainder)))) {
                        number += " and ";
                    } else {
                        number += ", ";
                    }
                }
                number += fizzBuzz(megaCount, true);
                number += ORDERS[order];
            }
            remainder = n % magnitude;
            --order;
        }
        return number;
    }

    function fizzBuzz(n, forceWord)
    {
        if (!Number.isInteger(n))
        {
            throw new TypeError("Only integers supported");

        }
        if (n === 0) {
            if (forceWord) {
                return(WORDS[n]);

            } else {
                return(n);
            }
        }

        const negative = n < 0;
        if (negative) {
            n = -n;
        }

        n = fizzBuzzBasic(n);
        if (Number.isInteger(n)) {
            n = fizzBuzzLarge(n, forceWord);
        }

        if (negative) {
            if (Number.isInteger(n)) {
                return -n;

            } else  {
                return "minus " + n;
            }
        }
        return n;
    }

    function testSuite() {
        var tests = [
            function testFizzBuzz() {
                var target = [0, 1, 2, "fizz", 4, "buzz", "fizz", 7, 8, "fizz",
                              "buzz", 11, "fizz", "fizzteen", 14, "fizz-buzz", 16, 17, "fizz", 19,
                              "buzz", "fizz", 22, "twenty fizz", "fizz", "buzz", 26, "fizz", 28, 29,
                              "fizz-buzz", "fizzty one", "fizzty two", "fizz", "fizzty four", "buzz", "fizz", "fizzty seven", "fizzty eight", "fizz",
                              "buzz", 41, "fizz", "forty fizz", 44, "fizz-buzz", 46, 47, "fizz", 49,
                              "buzz", "fizz", "buzzty two", "buzzty fizz", "fizz", "buzz", "buzzty six", "fizz", "buzzty eight", "buzzty nine",
                              "fizz-buzz", 61, 62, "fizz", 64, "buzz", "fizz", 67, 68, "fizz",
                              "buzz", 71, "fizz", "seventy fizz", 74, "fizz-buzz", 76, 77, "fizz", 79,
                              "buzz", "fizz", 82, "eighty fizz", "fizz", "buzz", 86, "fizz", 88, 89,
                              "fizz-buzz", 91, 92, "fizz", 94, "buzz", "fizz", 97, 98, "fizz",
                              "buzz"];
                for (var i = 0; i < target.length; ++i) {
                    const fb = fizzBuzz(i);
                    if (logLevel > 1) {
                        console.log(`${i}: ${fb}`);
                    }
                    TEST.equals(fb, target[i]);
                }
                TEST.equals(fizzBuzz(0, true), "zero");
                TEST.equals(fizzBuzz(76, true), "seventy six");
                TEST.equals(fizzBuzz(253313), "two hundred and buzzty fizz thousand, fizz hundred and fizzteen");
                TEST.equals(fizzBuzz(1234562), "one million, fizz thousand, buzz hundred and sixty two");
                TEST.equals(fizzBuzz(1234567), "one million, fizz thousand and fizz");
                TEST.equals(fizzBuzz(5000000015), "buzz");
                TEST.equals(fizzBuzz(5000002003), "buzz billion, two thousand and fizz");
            }
        ];

        TEST.run("FizzBuz", tests, true);
    }

    return {
        fizzBuzz: fizzBuzz,
        testSuite: testSuite
    };
}());