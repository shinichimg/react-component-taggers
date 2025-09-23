import { parse } from "@babel/parser";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import * as nodePath from "path";

const validExtensions = new Set([".jsx", ".tsx"]);

export default function jsxTagger() {
  const prefix = "data-simplify";
  const include = (id: string) =>
    validExtensions.has(nodePath.extname(id)) && !id.includes("node_modules");
  let isEnabled = true;
  const includeProps = true;
  const stats = {
    totalFiles: 0,
    processedFiles: 0,
    totalElements: 0,
  };

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

      stats.totalFiles++;
      const relativePath = nodePath.relative(process.cwd(), id);

      try {
        const parserOptions = {
          sourceType: "module" as const,
          plugins: ["jsx", "typescript"] as any[],
        };

        const ast = parse(code, parserOptions);
        const magicString = new MagicString(code);
        let changedElementsCount = 0;
        let currentElement: any = null;

        walk(ast as any, {
          enter(node: any) {
            if (node.type === "JSXElement") {
              currentElement = node;
            }

            if (node.type === "JSXOpeningElement") {
              const jsxNode = node;
              let elementName: string;

              if (jsxNode.name.type === "JSXIdentifier") {
                elementName = jsxNode.name.name;
              } else if (jsxNode.name.type === "JSXMemberExpression") {
                const memberExpr = jsxNode.name;
                elementName = `${memberExpr.object.name}.${memberExpr.property.name}`;
              } else {
                return;
              }

              if (
                elementName === "Fragment" ||
                elementName === "React.Fragment"
              ) {
                return;
              }

              const hasOurAttributes = jsxNode.attributes.some(
                (attr: any) =>
                  attr.type === "JSXAttribute" &&
                  attr.name.name.startsWith(prefix)
              );

              if (hasOurAttributes) {
                return;
              }

              const attributes = jsxNode.attributes.reduce(
                (acc: any, attr: any) => {
                  if (attr.type === "JSXAttribute") {
                    if (attr.value?.type === "StringLiteral") {
                      acc[attr.name.name] = attr.value.value;
                    } else if (
                      attr.value?.type === "JSXExpressionContainer" &&
                      attr.value.expression.type === "StringLiteral"
                    ) {
                      acc[attr.name.name] = attr.value.expression.value;
                    }
                  }
                  return acc;
                },
                {}
              );

              // Find className attribute line position
              let classNameLine = null;
              const classNameAttr = jsxNode.attributes.find(
                (attr: any) =>
                  attr.type === "JSXAttribute" &&
                  attr.name.type === "JSXIdentifier" &&
                  attr.name.name === "className"
              );
              if (classNameAttr && classNameAttr.loc?.start?.line) {
                classNameLine = classNameAttr.loc.start.line;
              }

              let textContent = "";
              if (currentElement && currentElement.children) {
                textContent = currentElement.children
                  .map((child: any) => {
                    if (child.type === "JSXText") {
                      return child.value.trim();
                    } else if (child.type === "JSXExpressionContainer") {
                      if (child.expression.type === "StringLiteral") {
                        return child.expression.value;
                      }
                    }
                    return "";
                  })
                  .filter(Boolean)
                  .join(" ")
                  .trim();
              }

              const content: any = {};
              if (textContent) {
                content.text = textContent;
              }
              if (attributes.placeholder) {
                content.placeholder = attributes.placeholder;
              }
              if (attributes.className) {
                content.className = attributes.className;
              }

              const line = jsxNode.loc?.start?.line ?? 0;
              const col = jsxNode.loc?.start?.column ?? 0;
              const dataComponentId = `${relativePath}:${line}:${col}`;
              const fileName = nodePath.basename(id);

              // Add className-Line attribute if className exists
              let classNameLineAttribute = "";
              if (classNameLine) {
                classNameLineAttribute = ` data-classname-line="${classNameLine}"`;
              }

              const legacyIds = ` data-component-path="${relativePath}" data-component-line="${line}" data-component-file="${fileName}" data-component-name="${elementName}" ${classNameLineAttribute}`;
          
              magicString.appendLeft(
                jsxNode.name.end ?? 0,
                ` ${prefix}-id="${dataComponentId}" ${prefix}-name="${elementName}"${legacyIds}`
              );

              changedElementsCount++;
            }
          },
        });

        stats.processedFiles++;
        stats.totalElements += changedElementsCount;

        if (changedElementsCount > 0) {
          return {
            code: magicString.toString(),
            map: magicString.generateMap({hires: true}),
          };
        }

        return null;
      } catch (error) {
        console.error(`Error processing file ${relativePath}:`, error);
        stats.processedFiles++;
        return null;
      }
    },
  };
}
