import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [events, setEvents] = useState([]);

  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const fetchEvents = () => {
    fetch("http://127.0.0.1:8000/events/")
      .then((response) => response.json())
      .then((data) => {
        setEvents(data.events);
      })
      .catch((error) => {
        console.error("Failed to fetch events:", error);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const createEvent = async (e) => {
    e.preventDefault();

    if (!eventType) {
      alert("Please enter an event type.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/events/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          location: location,
          description: description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      setEventType("");
      setLocation("");
      setDescription("");

      fetchEvents();
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Could not create event.");
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">S</div>

          <div>
            <h1>SENTRA</h1>
            <span>Environmental Intelligence</span>
          </div>
        </div>

        <nav>
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Events</button>
          <button className="nav-item">Analytics</button>
          <button className="nav-item">Digital Twin</button>
        </nav>

        <div className="sidebar-status">
          <span className="status-dot"></span>
          System Online
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ENVIRONMENTAL INTELLIGENCE</p>
            <h2>Dashboard</h2>
          </div>

          <div className="connection">
            <span className="status-dot"></span>
            Backend Connected
          </div>
        </header>

        <section className="hero-grid">
          <div className="environment-card">
            <div className="card-header">
              <div>
                <p className="card-label">LIVE ENVIRONMENT</p>
                <h3>Current Environment</h3>
              </div>

              <span className="live-badge">LIVE</span>
            </div>

            <div className="camera-placeholder">
              <div className="scan-line"></div>

              <div className="camera-content">
                <div className="camera-icon">◉</div>

                <p>Camera Feed</p>

                <span>
                  Environmental perception ready
                </span>
              </div>
            </div>
          </div>

          <div className="overview-card">
            <p className="card-label">SYSTEM OVERVIEW</p>

            <h3>Environment Status</h3>

            <div className="overview-status">
              <span className="status-dot"></span>
              Normal
            </div>

            <div className="overview-line">
              <span>Events today</span>
              <strong>{events.length}</strong>
            </div>

            <div className="overview-line">
              <span>Active sensors</span>
              <strong>5</strong>
            </div>

            <div className="overview-line">
              <span>Anomalies</span>
              <strong>0</strong>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <p className="card-label">EVENT CREATION</p>
              <h3>Create Environment Event</h3>
            </div>
          </div>

          <form className="event-form" onSubmit={createEvent}>
            <input
              type="text"
              placeholder="Event type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            />

            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button type="submit">
              Create Event
            </button>
          </form>
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <p className="card-label">SENSOR DATA</p>
              <h3>Environment Conditions</h3>
            </div>
          </div>

          <div className="sensor-grid">
            <SensorCard title="Temperature" value="--" unit="°C" />
            <SensorCard title="Humidity" value="--" unit="%" />
            <SensorCard title="Light" value="--" unit="%" />
            <SensorCard title="Motion" value="--" unit="" />
            <SensorCard title="Distance" value="--" unit="cm" />
          </div>
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <p className="card-label">EVENT MEMORY</p>
              <h3>Recent Events</h3>
            </div>
          </div>

          <div className="events-card">
            {events.length === 0 ? (
              <div className="empty-events">
                No events recorded yet.
              </div>
            ) : (
              events.map((event) => (
                <div className="event-row" key={event.id}>
                  <div className="event-indicator"></div>

                  <div className="event-info">
                    <strong>{event.event_type}</strong>

                    <span>
                      {event.location || "Unknown location"}
                      {event.description
                        ? ` • ${event.description}`
                        : ""}
                    </span>
                  </div>

                  <div className="event-status">
                    Recorded
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SensorCard({ title, value, unit }) {
  return (
    <div className="sensor-card">
      <span className="sensor-title">
        {title}
      </span>

      <div className="sensor-value">
        {value}
        <small>{unit}</small>
      </div>

      <span className="sensor-state">
        Awaiting data
      </span>
    </div>
  );
}

export default App;