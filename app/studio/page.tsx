import { Studio } from "@/components/studio/studio";
import { createMetadata } from "@/seo/metadata";

export const metadata = createMetadata({
  title: "Studio",
  description:
    "Upload an SVG, see how it is built, and pick an animation that fits it.",
  canonical: "/studio",
  noIndex: true,
});

const StudioPage = () => (
  <section className="mx-auto mt-[60px] flex w-full flex-col items-center">
    <h1 className="px-4 text-center font-sans text-[32px] min-[640px]:text-[42px]">
      Animate your SVG<span className="text-primary">*</span>
    </h1>
    <p className="mt-5 max-w-[520px] px-4 text-center font-mono text-secondary text-sm">
      drop an icon. the studio reads its shapes and suggests motion that fits
      what it means.
    </p>
    <Studio />
  </section>
);

export default StudioPage;
