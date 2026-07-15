import { ShaderDescriptor } from "@atlasjs/nebula";

const OBJECT_PRELUDE: string = `struct ObjectUniforms {
  model: mat4x4<f32>,
};

@group(1) @binding(0)
var<uniform> uObject: ObjectUniforms;`;

const VERTEX_PRELUDE: string = `struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct FragmentInput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> FragmentInput {
  var out: FragmentInput;
  out.uv = input.uv;
  out.position = uGlobal.viewProjection * uObject.model * vec4<f32>(input.position, 0.0, 1.0);
  return out;
}`;

const MATERIAL_GROUP: number = 2;
const MATERIAL_BLOCK_START: RegExp = /material\s*\{/;

type MaterialMember = {
  readonly name: string;
  readonly type: string;
  readonly isResource: boolean;
};

type MaterialBlock = {
  readonly full: string;
  readonly inner: string;
};

export function defineMaterial(source: string): ShaderDescriptor {
  return { source: buildMaterialShaderSource(source) };
}

export function buildMaterialShaderSource(source: string): string {
  const block: MaterialBlock | null = extractMaterialBlock(source);
  const members: MaterialMember[] = parseMaterialBlock(source, block);
  const materialGroup: string = generateMaterialGroup(members);
  const userCode: string = block
    ? source.replace(block.full, "").trim()
    : source.trim();

  return [OBJECT_PRELUDE, VERTEX_PRELUDE, materialGroup, userCode]
    .filter((section: string) => section.length > 0)
    .join("\n\n");
}

function extractMaterialBlock(source: string): MaterialBlock | null {
  const match: RegExpMatchArray | null = source.match(MATERIAL_BLOCK_START);

  if (!match || match.index === undefined) {
    return null;
  }

  const braceStart: number = match.index + match[0].length - 1;
  let depth: number = 0;

  for (let i: number = braceStart; i < source.length; i++) {
    const char: string = source[i];

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return {
          full: source.slice(match.index, i + 1),
          inner: source.slice(braceStart + 1, i),
        };
      }
    }
  }

  throw new Error("Unterminated `material { ... }` block; missing `}`.");
}

function parseMaterialBlock(
  source: string,
  block: MaterialBlock | null,
): MaterialMember[] {
  if (!block) {
    return [];
  }

  if (MATERIAL_BLOCK_START.test(source.replace(block.full, ""))) {
    throw new Error("Only a single `material { ... }` block is supported.");
  }

  return splitMembers(block.inner)
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0)
    .map(parseMember);
}

function splitMembers(inner: string): string[] {
  const members: string[] = [];
  let depth: number = 0;
  let start: number = 0;

  for (let i: number = 0; i < inner.length; i++) {
    const char: string = inner[i];

    if (char === "<") {
      depth++;
    } else if (char === ">") {
      depth = Math.max(depth - 1, 0);
    } else if (depth === 0 && (char === "," || char === ";" || char === "\n")) {
      members.push(inner.slice(start, i));
      start = i + 1;
    }
  }

  members.push(inner.slice(start));

  return members;
}

function parseMember(entry: string): MaterialMember {
  const separator: number = entry.indexOf(":");

  if (separator === -1) {
    throw new Error(
      `Invalid material member "${entry}"; expected "name: type".`,
    );
  }

  const name: string = entry.slice(0, separator).trim();
  const type: string = entry.slice(separator + 1).trim();
  const baseType: string = type.split("<")[0].trim();
  const isResource: boolean =
    baseType.startsWith("texture") || baseType.startsWith("sampler");

  return { name, type, isResource };
}

function generateMaterialGroup(members: MaterialMember[]): string {
  const uniforms: MaterialMember[] = members.filter((m) => !m.isResource);
  const resources: MaterialMember[] = members.filter((m) => m.isResource);

  const lines: string[] = [];
  let binding: number = 0;

  if (uniforms.length > 0) {
    const fields: string = uniforms
      .map((member: MaterialMember) => `  ${member.name}: ${member.type},`)
      .join("\n");

    lines.push(`struct Material {\n${fields}\n};`);
    lines.push(
      `@group(${MATERIAL_GROUP}) @binding(${binding}) var<uniform> material: Material;`,
    );
    binding++;
  }

  for (const resource of resources) {
    lines.push(
      `@group(${MATERIAL_GROUP}) @binding(${binding}) var ${resource.name}: ${resource.type};`,
    );
    binding++;
  }

  return lines.join("\n");
}
