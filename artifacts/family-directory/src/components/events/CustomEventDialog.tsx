import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CUSTOM_EVENT_CATEGORIES, CustomEvent } from "@/types/customEvent";
import { useCustomEventsStore } from "@/hooks/useCustomEventsStore";
import { toast } from "sonner";

const schema = z.object({
  title:       z.string().min(1, "Title is required"),
  date:        z.string().min(10, "Date is required"),
  category:    z.enum(["reunion","ceremony","celebration","festival","memorial","other"]),
  description: z.string().optional(),
  location:    z.string().optional(),
  imageUrl:    z.string().url("Must be a valid URL").optional().or(z.literal("")),
  recurring:   z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, the dialog is in edit mode */
  event?: CustomEvent;
}

export function CustomEventDialog({ open, onClose, event }: Props) {
  const { addEvent, updateEvent } = useCustomEventsStore();
  const isEditing = Boolean(event);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:       event?.title ?? "",
      date:        event?.date ?? "",
      category:    event?.category ?? "celebration",
      description: event?.description ?? "",
      location:    event?.location ?? "",
      imageUrl:    event?.imageUrl ?? "",
      recurring:   event?.recurring ?? true,
    },
  });

  const onSubmit = (values: FormValues) => {
    const data = {
      title:             values.title.trim(),
      date:              values.date,
      category:          values.category,
      description:       values.description?.trim() || undefined,
      location:          values.location?.trim() || undefined,
      imageUrl:          values.imageUrl?.trim() || undefined,
      recurring:         values.recurring,
      relatedMemberIds:  event?.relatedMemberIds ?? [],
    };

    if (isEditing && event) {
      updateEvent(event.id, data);
      toast.success("Event updated");
    } else {
      addEvent(data);
      toast.success("Event added");
    }
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEditing ? "Edit Event" : "Add Custom Event"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Shah Family Reunion" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CUSTOM_EVENT_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.emoji} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A short description of this event…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ahmedabad, Gujarat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recurring"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={field.value}
                      onChange={e => field.onChange(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <FormLabel htmlFor="recurring" className="cursor-pointer mb-0">
                      Repeat every year on this date
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">
                {isEditing ? "Save Changes" : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
