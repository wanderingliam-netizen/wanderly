from flask import Flask, render_template, request, jsonify
import json
import os
from uuid import uuid4

app = Flask(__name__)
DATA_FILE = os.path.join(app.root_path, "data", "trips.json")


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"trips": []}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"trips": []}


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/trips", methods=["GET"])
def get_trips():
    return jsonify(load_data()["trips"])


@app.route("/api/trips", methods=["POST"])
def create_trip():
    body = request.get_json()
    destination = body.get("destination", "").strip()
    start_date = body.get("start_date", "").strip()
    end_date = body.get("end_date", "").strip()
    budget = body.get("budget", 0)

    if not destination or not start_date or not end_date:
        return jsonify({"error": "Destination and dates are required."}), 400

    try:
        budget = float(budget or 0)
    except ValueError:
        return jsonify({"error": "Budget must be a number."}), 400

    data = load_data()
    trip = {
        "id": str(uuid4()),
        "destination": destination,
        "start_date": start_date,
        "end_date": end_date,
        "budget": budget,
        "activities": []
    }
    data["trips"].append(trip)
    save_data(data)
    return jsonify(trip), 201


@app.route("/api/trips/<trip_id>", methods=["DELETE"])
def delete_trip(trip_id):
    data = load_data()
    before = len(data["trips"])
    data["trips"] = [t for t in data["trips"] if t["id"] != trip_id]

    if len(data["trips"]) == before:
        return jsonify({"error": "Trip not found."}), 404

    save_data(data)
    return jsonify({"success": True})


@app.route("/api/trips/<trip_id>/activities", methods=["POST"])
def add_activity(trip_id):
    body = request.get_json()
    name = body.get("name", "").strip()
    date = body.get("date", "").strip()
    time = body.get("time", "").strip()
    cost = body.get("cost", 0)
    category = body.get("category", "Experience").strip() or "Experience"

    if not name:
        return jsonify({"error": "Activity name is required."}), 400

    try:
        cost = float(cost or 0)
    except ValueError:
        return jsonify({"error": "Cost must be a number."}), 400

    data = load_data()
    for trip in data["trips"]:
        if trip["id"] == trip_id:
            activity = {
                "id": str(uuid4()),
                "name": name,
                "date": date,
                "time": time,
                "cost": cost,
                "category": category
            }
            trip["activities"].append(activity)
            save_data(data)
            return jsonify(activity), 201

    return jsonify({"error": "Trip not found."}), 404


@app.route("/api/trips/<trip_id>/activities/<activity_id>", methods=["DELETE"])
def delete_activity(trip_id, activity_id):
    data = load_data()
    for trip in data["trips"]:
        if trip["id"] == trip_id:
            trip["activities"] = [
                a for a in trip["activities"] if a["id"] != activity_id
            ]
            save_data(data)
            return jsonify({"success": True})

    return jsonify({"error": "Trip not found."}), 404


if __name__ == "__main__":
    app.run(debug=True)