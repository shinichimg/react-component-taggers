import _generate from "@babel/generator";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import * as fs from "fs";
import * as nodePath from "path";

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

export interface JSXTaggerOptions {
  /**
   * Prefix for data attributes
   * @default 'data-platform'
   */
  prefix?: string;

  /**
   * Whether to enable the plugin
   * @default true in development, false in production
   */
  enabled?: boolean;

  /**
   * Include props snapshot in attributes
   * @default false
   */
  includeProps?: boolean;

  /**
   * Custom filter function to determine which files to process
   * @default processes .jsx, .tsx files
   */
  include?: (id: string) => boolean;
}

export default function jsxTagger(options: JSXTaggerOptions = {}) {
  const {include = (id: string) => /\.(jsx|tsx)$/.test(id)} = options;

  const includeProps = true;
  const prefix = "data-simplify";
  let isEnabled = true;

  return {
    name: "jsx-tagger",
    enforce: "pre" as const,

    configResolved(config: any) {
      if (isEnabled === undefined) {
        isEnabled = config.command === "serve" || config.mode === "development";
      }
    },

    transform(code: string, id: string) {
      if (!isEnabled || !include(id)) {
        return null;
      }

      let originalCode: string;
      try {
        originalCode = fs.readFileSync(id, "utf-8");
      } catch (error) {
        originalCode = code;
      }

      try {
        const ast = parse(originalCode, {
          sourceType: "module",
          plugins: ["jsx", "typescript", "decorators-legacy"],
          ranges: true,
        });

        let modified = false;

        traverse(ast, {
          JSXElement(path: any) {
            const element = path.node;
            const openingElement = element.openingElement;

            const hasOurAttributes = openingElement.attributes.some(
              (attr: any) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name.startsWith(prefix)
            );

            if (hasOurAttributes) {
              return;
            }

            const loc = element.loc;
            if (!loc) return;

            const line = loc.start.line;
            const column = loc.start.column + 1;

            const filePath = nodePath.relative(process.cwd(), id);
            const fileName = nodePath.basename(filePath);

            const elementName = t.isJSXIdentifier(openingElement.name)
              ? openingElement.name.name
              : "unknown";

            const uniqueId = `${filePath}:${line}:${column}`;

            const attributesToAdd = [
              t.jsxAttribute(
                t.jsxIdentifier(`${prefix}-id`),
                t.stringLiteral(uniqueId)
              ),
              t.jsxAttribute(
                t.jsxIdentifier(`${prefix}-name`),
                t.stringLiteral(elementName)
              ),
              t.jsxAttribute(
                t.jsxIdentifier(`data-component-path`),
                t.stringLiteral(filePath)
              ),
              t.jsxAttribute(
                t.jsxIdentifier(`data-component-line`),
                t.stringLiteral(line.toString())
              ),
              t.jsxAttribute(
                t.jsxIdentifier(`data-component-file`),
                t.stringLiteral(fileName)
              ),
              t.jsxAttribute(
                t.jsxIdentifier(`data-component-name`),
                t.stringLiteral(elementName)
              ),
            ];

            if (includeProps && openingElement.attributes.length > 0) {
              try {
                const props: Record<string, any> = {};

                openingElement.attributes.forEach((attr: any) => {
                  if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                    const name = attr.name.name;
                    if (attr.value) {
                      if (t.isStringLiteral(attr.value)) {
                        props[name] = attr.value.value;
                      } else if (t.isJSXExpressionContainer(attr.value)) {
                        props[name] = "[expression]";
                      }
                    } else {
                      props[name] = true;
                    }
                  }
                });

                const propsJson = JSON.stringify(props);
                const encodedProps = encodeURIComponent(propsJson);

                attributesToAdd.push(
                  t.jsxAttribute(
                    t.jsxIdentifier(`${prefix}-props`),
                    t.stringLiteral(encodedProps)
                  )
                );
              } catch (error) {
                console.warn(
                  `Failed to serialize props for ${uniqueId}:`,
                  error
                );
              }
            }

            openingElement.attributes.unshift(...attributesToAdd);

            modified = true;
          },
        });

        if (modified) {
          const output = generate(ast, {
            retainLines: true,
            compact: false,
          });

          return {
            code: output.code,
            map: output.map,
          };
        }

        return null;
      } catch (error) {
        console.warn(`JSX Tagger failed to parse ${id}:`, error);
        return null;
      }
    },
  };
}
