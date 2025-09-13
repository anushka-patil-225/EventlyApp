import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1000,        // 1000 concurrent users
  duration: "10s",  // run for 10 seconds
};

const BASE_URL = "http://localhost:3000"; // change if deployed
const EVENT_ID = 1;   // your event ID
const SEAT_NUMBER = 1; // your seat number
const TOKEN = __ENV.TOKEN; // we’ll pass it via env variable

export default function () {
  const url = `${BASE_URL}/bookings`;
  const payload = JSON.stringify({
    eventId: EVENT_ID,
    seatNumber: SEAT_NUMBER,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOKEN}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status is 201": (r) => r.status === 201,
    "status is 400 (seat already taken)": (r) => r.status === 400,
    "status is 401 unauthorized": (r) => r.status === 401,
  });

  sleep(1);
}
