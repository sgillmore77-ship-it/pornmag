/** Topics a visitor can choose on the contact form. Kept free of server imports for the browser. */
export const CONTACT_TOPICS = {
  general: "General enquiry",
  advertising: "Advertising",
  press: "Press",
  removal: "Content removal / DMCA",
  technical: "Problem with the site",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;
