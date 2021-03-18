var MIN_UNEXCLUDED_NATURAL = (function () {
    "use strict";

    function excludeFromRanges(ranges, a) {
        if (a < 1) {
            return;
        }

        for (var i = 0; i < ranges.length; ++i) {
            var range = ranges[i];
            var rangeEnd = range.start + range.count - 1;
            if (a > rangeEnd) {
                continue;

            } else if (range.start > a) {
                return;

            } else if (a === range.start) {
                range.start += 1;
                range.count -= 1;
                if (range.count === 0)
                {
                    ranges.splice(i, 1);
                }
                return;

            } else if (a === rangeEnd) {
                range.count -= 1;
                if (range.count === 0)
                {
                    ranges.splice(i, 1);
                }
                return;

            } else if (a < rangeEnd) {
                range.count = a - range.start;
                ranges.splice(i + 1, 0, {start: a + 1, count: rangeEnd - a});
                return;

            }
        }
    }

    function minUnexcludedNaturalViaRanges(A) {
        var ranges = [{start: 1, count: Number.MAX_SAFE_INTEGER-1}];
        A.forEach(a => excludeFromRanges(ranges, a));
        return ranges[0].start;
    }

    function minUnexcludedNaturalViaSort(A) {
        A = A.filter(a => a > 0);
        A.sort((a, b) => a - b);
        var prev = 0;
        for (var i = 0; i < A.length; ++i) {
            var next = A[i];
            if ((next - prev) > 1) {
                break;
            }

            prev = next;
        }
        return prev + 1;
    }

    function testSuite() {
        var tests = [
            function testMinNaturalViaRanges() {
                TEST.equals(minUnexcludedNaturalViaRanges([1, 3, 6, 4, 1, 2]), 5);
                TEST.equals(minUnexcludedNaturalViaRanges([1, 2, 3, 4, 5, 6]), 7);
            },
            function testMinNaturalViaSort() {
                TEST.equals(minUnexcludedNaturalViaSort([1, 3, 6, 4, 1, 2]), 5);
                TEST.equals(minUnexcludedNaturalViaSort([1, 2, 3, 4, 5, 6]), 7);
            }
        ];

        TEST.run("Min Unexcluded Natural", tests, true);
    }

    return {
        testSuite: testSuite
    };
}());