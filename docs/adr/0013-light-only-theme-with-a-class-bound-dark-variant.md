# 13. Light-only theme, with the dark variant bound to a class

## Decision

The app defines light tokens only. Tailwind's `dark:` variant is rebound from
its default `prefers-color-scheme` media query to a class selector:

```css
@custom-variant dark (&:is(.dark *));
```

`color-scheme: light` is also set on `:root`.

## Why

shadcn/ui components ship `dark:` utilities. With the default media-query
variant, those applied on any machine set to dark — on top of a theme that has
no dark tokens. The result was a half-styled UI: a destructive button at 60%
opacity, inputs at 30%, against light surfaces.

Binding the variant to a `.dark` class means those utilities never match until
a dark theme actually exists.

## Pros

- What renders no longer depends on the operating system preference.
- Adding dark mode later is additive: define the tokens, put `.dark` on the
  root, and the utilities already in the components start working.

## Cons

- Users who prefer dark get light anyway, with no way to opt in.
- The `dark:` classes throughout the components are dead code until then, and
  read as though dark mode is supported.
