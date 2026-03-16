"use client";

import { useState } from "react";

export default function Home() {
  const [subject, setSubject] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  async function searchCourses() {
    setLoading(true);
    const res = await fetch(`/api/courses?subject=${subject}`);
    const data = await res.json();
    setCourses(data);
    setLoading(false);
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Concordia Scheduler</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Enter subject code (e.g. COMP)"
          value={subject}
          onChange={(e) => setSubject(e.target.value.toUpperCase())}
          className="border p-2 rounded w-80"
        />
        <button
          onClick={searchCourses}
          className="bg-burgundy-600 text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </div>

      {loading && <p>Loading...</p>}

      <ul>
        {courses.map((course: any) => (
          <li key={course.ID} className="mb-2 p-3 border rounded">
            <span className="font-bold">{course.subject} {course.catalog}</span> — {course.title}
          </li>
        ))}
      </ul>
    </main>
  );
}