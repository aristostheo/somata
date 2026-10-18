import { CalendarRecord } from "@/components/somata/CalendarRecord";
import { Button, TaskSheet } from "@/components/somata/TaskUI";
import type { DayData } from "@/services/calendarData";
export default function DayDetailSheet({ visible, onClose, day, isToday, onLogNutrition }: {
  visible: boolean; onClose: () => void; day: DayData | null; isToday?: boolean; onLogNutrition?: () => void;
}) {
  return <TaskSheet visible={visible} onClose={onClose} title={day ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Day detail'}>

    <CalendarRecord day={day} />

    {!day?.nutrition && isToday && onLogNutrition && <Button label="Log nutrition" icon="add" primary onPress={onLogNutrition} />}

  </TaskSheet>;
}
