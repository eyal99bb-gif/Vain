This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Virtual Try-On (עגילים בתלת־ממד)

`/try-on` is a Maria-Tash-style virtual try-on studio: a photorealistic 3D ear
(real head scan) with clickable piercing spots (lobe, helix, tragus, conch,
flat, forward helix…), a catalog of earrings (studs, hoops, dangles) rendered
with PBR gold/white-gold/rose-gold materials and studio lighting, built with
[three.js](https://threejs.org), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)
and [@react-three/drei](https://github.com/pmndrs/drei).

- Piercing-spot anchor data: `src/components/tryon/anchors.ts` (positions were
  harvested by raycasting against the mesh — open `/try-on?debug=1` and click
  the ear to log new anchor coordinates to the console).
- Earring designs & materials: `src/components/tryon/catalog.tsx`
- 3D scene (head, lighting, placement math): `src/components/tryon/Scene.tsx`
- Head-scan model credits: `public/models/LICENSE.md` (CC BY 3.0, Infinite Realities)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
