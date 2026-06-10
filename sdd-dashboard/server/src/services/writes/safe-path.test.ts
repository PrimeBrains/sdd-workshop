import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../../config.js";
import { AppError, ErrorCode } from "../../errors/codes.js";
import { createSafePathGuard } from "./safe-path.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-safepath-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** .kiro/ の外側に脱出先ディレクトリを作る */
function makeOutsideDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sdd-core-outside-"));
  tempDirs.push(dir);
  return dir;
}

/** AppError(WRITE_PATH_FORBIDDEN) で拒否されることを検証する */
async function expectForbidden(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(ErrorCode.WRITE_PATH_FORBIDDEN);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createSafePathGuard / assertWritablePath", () => {
  it(".kiro/ 内の既存ファイルパスを検証済み絶対パスとして返す（12.1）", async () => {
    const context = makeRepo();
    mkdirSync(join(context.kiroDir, "specs", "alpha"), { recursive: true });
    const target = join(context.kiroDir, "specs", "alpha", "spec.json");
    writeFileSync(target, "{}");
    const guard = createSafePathGuard(context);

    await expect(guard.assertWritablePath(target)).resolves.toBe(realpathSync(target));
  });

  it("未作成の深いパス（新規 ADR）も最近接の実在祖先の realpath で検証して許可する（12.1）", async () => {
    const context = makeRepo();
    const guard = createSafePathGuard(context);
    // .kiro/adr/ はまだ存在しない → 実在祖先 .kiro/ の realpath で prefix 検査される
    const candidate = join(context.kiroDir, "adr", "0042-new-decision.md");

    await expect(guard.assertWritablePath(candidate)).resolves.toBe(
      join(realpathSync(context.kiroDir), "adr", "0042-new-decision.md"),
    );
  });

  it("`../` 連鎖で .kiro/ 外へ解決されるパスを拒否する（12.2）", async () => {
    const context = makeRepo();
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath(join(context.kiroDir, "../../../../etc/passwd")));
    await expectForbidden(guard.assertWritablePath(join(context.kiroDir, "specs", "..", "..", "escaped.md")));
    await expectForbidden(guard.assertWritablePath("../outside.md"));
  });

  it(".kiro/ 外の絶対パスを拒否する（12.2）", async () => {
    const context = makeRepo();
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath("/etc/passwd"));
    await expectForbidden(guard.assertWritablePath(join(context.repoRoot, "package.json")));
  });

  it(".kiro/ ディレクトリ自体は書込先として拒否する", async () => {
    const context = makeRepo();
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath(context.kiroDir));
  });

  it(".kiro/ 内の symlink ディレクトリが外を指す場合、その配下への書込を拒否する（12.2）", async () => {
    const context = makeRepo();
    const outside = makeOutsideDir();
    mkdirSync(join(context.kiroDir, "specs"));
    symlinkSync(outside, join(context.kiroDir, "specs", "evil"));
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath(join(context.kiroDir, "specs", "evil", "new.md")));
  });

  it(".kiro/ 内の symlink ファイルが外を指す場合、そのパスへの書込を拒否する（12.2）", async () => {
    const context = makeRepo();
    const outside = makeOutsideDir();
    const outsideFile = join(outside, "victim.json");
    writeFileSync(outsideFile, "untouched");
    symlinkSync(outsideFile, join(context.kiroDir, "link.json"));
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath(join(context.kiroDir, "link.json")));
  });

  it("外を指す dangling symlink への書込を拒否する（12.2）", async () => {
    const context = makeRepo();
    const outside = makeOutsideDir();
    symlinkSync(join(outside, "not-yet-created.md"), join(context.kiroDir, "dangling.md"));
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.assertWritablePath(join(context.kiroDir, "dangling.md")));
  });

  it(".kiro/ 内に留まる symlink は realpath 解決後のパスで許可する", async () => {
    const context = makeRepo();
    mkdirSync(join(context.kiroDir, "specs", "alpha"), { recursive: true });
    symlinkSync(join(context.kiroDir, "specs", "alpha"), join(context.kiroDir, "alias"));
    const guard = createSafePathGuard(context);

    await expect(guard.assertWritablePath(join(context.kiroDir, "alias", "spec.json"))).resolves.toBe(
      join(realpathSync(context.kiroDir), "specs", "alpha", "spec.json"),
    );
  });

  it("symlink 経由で参照された .kiro/ 内パスは実体パスへ正規化して許可する（kiroDir 側も realpath 比較）", async () => {
    const context = makeRepo();
    const aliasRoot = join(makeOutsideDir(), "repo-alias");
    symlinkSync(context.repoRoot, aliasRoot);
    const guard = createSafePathGuard(context);

    await expect(guard.assertWritablePath(join(aliasRoot, ".kiro", "specs", "a", "spec.json"))).resolves.toBe(
      join(realpathSync(context.kiroDir), "specs", "a", "spec.json"),
    );
  });
});

describe("createSafePathGuard / writeFileAtomic", () => {
  it("新規ファイルを書き込み、temp ファイルを残さない（12.4）", async () => {
    const context = makeRepo();
    mkdirSync(join(context.kiroDir, "specs", "alpha"), { recursive: true });
    const target = join(context.kiroDir, "specs", "alpha", "spec.json");
    const guard = createSafePathGuard(context);

    await guard.writeFileAtomic(target, '{"phase":"initialized"}');

    expect(readFileSync(target, "utf8")).toBe('{"phase":"initialized"}');
    expect(readdirSync(join(context.kiroDir, "specs", "alpha"))).toEqual(["spec.json"]);
  });

  it("既存ファイルを新内容へ置き換える（12.4）", async () => {
    const context = makeRepo();
    const target = join(context.kiroDir, "doc.md");
    writeFileSync(target, "old content");
    const guard = createSafePathGuard(context);

    await guard.writeFileAtomic(target, "new content");

    expect(readFileSync(target, "utf8")).toBe("new content");
  });

  it("exclusive: 既存ファイルがあると失敗し、旧内容をバイト単位で保持する（11.5, 12.4）", async () => {
    const context = makeRepo();
    const target = join(context.kiroDir, "adr.md");
    writeFileSync(target, "original adr body");
    const guard = createSafePathGuard(context);

    await expect(guard.writeFileAtomic(target, "overwrite attempt", { exclusive: true })).rejects.toMatchObject({
      code: "EEXIST",
    });

    expect(readFileSync(target, "utf8")).toBe("original adr body");
    expect(readdirSync(context.kiroDir)).toEqual(["adr.md"]);
  });

  it("exclusive: 対象が存在しなければ作成する", async () => {
    const context = makeRepo();
    const target = join(context.kiroDir, "0001-first.md");
    const guard = createSafePathGuard(context);

    await guard.writeFileAtomic(target, "adr body", { exclusive: true });

    expect(readFileSync(target, "utf8")).toBe("adr body");
    expect(readdirSync(context.kiroDir)).toEqual(["0001-first.md"]);
  });

  it("書込が途中で失敗した場合、対象ファイルは旧内容のまま残る（12.4）", async () => {
    const context = makeRepo();
    const dir = join(context.kiroDir, "specs", "alpha");
    mkdirSync(dir, { recursive: true });
    const target = join(dir, "spec.json");
    writeFileSync(target, '{"phase":"old"}');
    const guard = createSafePathGuard(context);

    chmodSync(dir, 0o555); // temp ファイル作成を EACCES で失敗させる
    try {
      await expect(guard.writeFileAtomic(target, '{"phase":"new"}')).rejects.toMatchObject({
        code: "EACCES",
      });
    } finally {
      chmodSync(dir, 0o755);
    }

    expect(readFileSync(target, "utf8")).toBe('{"phase":"old"}');
    expect(readdirSync(dir)).toEqual(["spec.json"]);
  });

  it(".kiro/ 外へ解決されるパスへの書込はガードで拒否され、何も書かれない（12.1, 12.2）", async () => {
    const context = makeRepo();
    const outside = makeOutsideDir();
    const outsideFile = join(outside, "victim.txt");
    writeFileSync(outsideFile, "untouched");
    symlinkSync(outsideFile, join(context.kiroDir, "link.txt"));
    const guard = createSafePathGuard(context);

    await expectForbidden(guard.writeFileAtomic(join(context.kiroDir, "link.txt"), "pwned"));
    await expectForbidden(guard.writeFileAtomic(join(context.kiroDir, "../escape.txt"), "pwned"));

    expect(readFileSync(outsideFile, "utf8")).toBe("untouched");
    expect(readdirSync(outside)).toEqual(["victim.txt"]);
  });
});
