import { Studio } from "@/components/studio/studio";
import { createMetadata } from "@/seo/metadata";

export const metadata = createMetadata({
  title: "Studio",
  description:
    "Drop an SVG, say what it is for, and watch motion that follows that description.",
  canonical: "/studio",
  noIndex: true,
});

const StudioPage = () => (
  <section className="mx-auto mt-[60px] flex w-full flex-col items-center">
    <h1 className="px-4 text-center font-sans text-[32px] min-[640px]:text-[42px]">
      Animate your SVG<span className="text-primary">*</span>
    </h1>
    <p className="mt-5 max-w-[520px] px-4 text-center font-mono text-secondary text-sm">
      drop an icon and say what it is for. the studio reads the shapes and your
      words, then plays motion that fits.
    </p>
    <Studio />
  </section>
);

export default StudioPage;
