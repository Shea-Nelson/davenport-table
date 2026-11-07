import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dayPresence, normalizeStayMoment, stayOrderError } from "../lib/stay";

test("stay times outside the Eastern house window are refused", () => {
  assert.equal(normalizeStayMoment("2027-01-14T15:59:00-05:00"), undefined);
  assert.equal(normalizeStayMoment("2027-01-14T16:00:00-05:00"), "2027-01-14T16:00:00-05:00");
  assert.equal(normalizeStayMoment("2027-01-18T10:00:00-05:00"), "2027-01-18T10:00:00-05:00");
  assert.equal(normalizeStayMoment("2027-01-18T10:01:00-05:00"), undefined);
  assert.equal(normalizeStayMoment({ date: "2027-01-16", time: "09:30" }), "2027-01-16T09:30:00-05:00");
  assert.equal(normalizeStayMoment(null), null);
  assert.equal(normalizeStayMoment(""), null);
});

test("arrival must come before departure, and missing times are not a full stay", () => {
  const friday = "2027-01-15T18:00:00-05:00";
  const sunday = "2027-01-17T11:00:00-05:00";
  assert.equal(stayOrderError(sunday, friday), "Arrival has to be before departure. Times are Eastern.");
  assert.equal(stayOrderError(friday, sunday), null);
  assert.equal(stayOrderError(friday, null), null);
  const board = dayPresence([
    { id: "a", name: "Ada", arrivalAt: friday, departureAt: sunday },
    { id: "b", name: "Bea", arrivalAt: null, departureAt: null },
  ]);
  assert.equal(board.unset.map((peep) => peep.name).join(), "Bea");
  const fridayNames = board.days.find((day) => day.date === "2027-01-15")?.peeps.map((peep) => peep.name);
  const thursdayNames = board.days.find((day) => day.date === "2027-01-14")?.peeps.map((peep) => peep.name);
  assert.deepEqual(fridayNames, ["Ada"]);
  assert.deepEqual(thursdayNames, []);
});

test("day headers stay in the first row instead of sticking down into the first peep", () => {
  const css = readFileSync(new URL("../_next/static/chunks/3f92k8hgoqp7a.css", import.meta.url), "utf8");
  const start = css.indexOf(".stay-head{");
  const head = css.slice(start, css.indexOf(".stay-name{", start));
  assert.equal(start > -1, true);
  assert.equal(head.includes("sticky"), false);
  assert.equal(head.includes("top:"), false);
});
