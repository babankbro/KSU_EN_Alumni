import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import EventForm from "../EventForm";

export const metadata = { title: "สร้างกิจกรรม" };

export default async function NewEventPage() {
  await requireAdmin(["admin", "editor"]);
  return (
    <>
      <p className="small"><Link href="/admin/events">← กิจกรรมทั้งหมด</Link></p>
      <div className="admin-head"><h1>สร้างกิจกรรม</h1></div>
      <EventForm />
    </>
  );
}
