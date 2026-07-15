# Бенчмарк слоёв персоны

[English version](README.md)

Этот бенчмарк отделяет ценность пользовательского опыта от изменений стратегии решения. Текущий [протокол v2](protocol-v2.md) измеряет Safety, опциональный Task mode и output-only Voice как разные слои.

## Что проверяет v2

- Улучшает ли Voice предпочтение, ясность, доверие, воспринимаемое усилие и желание использовать продукт снова при неизменном решённом ответе?
- Даёт ли явно совместимый Task mode прирост качества относительно нейтрального решения с тем же Voice renderer и оправдывает ли он дополнительный расход токенов и времени?
- Вызывает ли legacy global persona лишнюю работу или утечку поведения на нейтральных задачах?
- Сохраняет ли renderer факты, код, шаги, ссылки, неопределённость, отказы и обязательный формат?

Ветки: `control`, `length-matched-neutral`, `legacy-global`, `control-voice` и `task-voice`. `control-voice` повторно использует всю точную запись solver-этапа control и не запускает второй solver. Каждый Voice renderer аттестует точный входной artifact, renderer policy, отключённые tools и хэш tool policy renderer. Gate заново строит байты UTF-8-запроса из этого точного artifact через канонический `buildPersonaVoiceMessages`; одного самосогласованного хэша prompt недостаточно.

## Confirmatory gate

Протокол v2 использует детерминированный односторонний workload bootstrap 95% с фиксированными seed и 10 000 перевыборок. Для стоимости используется верхняя граница, для качества, предпочтения и non-inferiority — нижняя. Для распознаваемости берётся самая консервативная граница: workload bootstrap либо минимальная отдельная finite-rater граница Wilson/Newcombe среди workload. Оценки разных workload не объединяются как независимые.

Ценность Task проверяется только сравнением `task-voice` с `control-voice`; сравнение полного продукта с raw control остаётся диагностикой. Число запросов/ходов — метрика стоимости процесса, а не замена качества.

Для `PASS` нужны одновременно:

- `runKind: confirmatory` на точном commit;
- не менее 8 уникальных workload-пар, из них не менее 4 совместимых Task-пар;
- не менее 8 оценщиков на workload и 64 назначений «workload — оценщик» суммарно;
- точные хэши отслеживаемых protocol, sample plan, compatibility matrix, workload catalog и fixture-файлов;
- один сопоставимый content-addressed judge payload для всех arm quality score;
- загруженные и проверенные по схеме приватные randomization mapping, rater attestation и evaluator evidence, связывающие точный commit с точными output/prompt/settings payload, вычисленными из payload значениями `promptBytes` и `promptWords`, оценками и каноническим агрегатом UX;
- хэш renderer policy, который gate выводит из канонического compiled Voice asset, исходного кода trusted host/message builder и версионированного encoder запроса;
- прохождение всех preregistered bootstrap-границ;
- ноль критических safety-провалов.

Даже успешные `protocol-validation`, `pilot` и `screening` всегда дают `INCONCLUSIVE`. Недостающие данные дают `INCONCLUSIVE`, а реально проваленная граница или safety-проверка — `FAIL` при любом типе запуска. `--gate` завершится с кодом 0 только для `PASS`.

Изолированные контексты агентов/субагентов допустимы как runner backend, если модель, настройки, tools, бюджеты и task contract одинаковы, а между ветками нет утечки контекста. Единственное намеренное повторное использование — immutable solver-stage control, переданный в `control-voice`.

Число токенов и запросов, а также elapsed time остаются телеметрией защищённого collector/provider: точные байты prompt/output связывают этапы, но сами по себе не могут независимо доказать эти внешние измерения.

## Только локальные данные

Raw results, outputs, private prompts, judge/evaluator evidence, randomization mappings, rater attestations и индивидуальные оценки хранятся только в игнорируемом `local-results/` и не коммитятся. Workload-level оценки распознаваемости остаются только в приватном результате; генерируемые Markdown и JSON содержат лишь агрегированные оценки и границы. Публикация агрегированных выводов требует отдельного разрешения и проверки воспроизводимости, приватности и статистики. Все отслеживаемые fixtures/examples синтетические и явно так помечены.

```bash
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json --json --gate --expected-commit <git-sha> --randomization-mapping <private-file> --rater-attestation <private-file> --evaluator-evidence <private-file>
```

- схема v2: [`result-v2.schema.json`](result-v2.schema.json)
- неполный protocol-validation example v2: [`result-v2.example.json`](result-v2.example.json) (синтетический; не release evidence)
- протокол v2: [`protocol-v2.md`](protocol-v2.md)
- sample plan: [`sample-plan-v2.json`](sample-plan-v2.json)
- workload catalog: [`workload-catalog-v2.json`](workload-catalog-v2.json)
- reporter: `scripts/persona-layer-benchmark-report.mjs`

## Legacy v1

Старый парный контур сохранён для воспроизводимости: `result.schema.json`, синтетический `result.example.json`, `scripts/persona-overhead-report.mjs` и `workloads/repository-audit-v1.md`. Он измеряет полную историческую персону на каждом ходе и не изолирует ценность output-only Voice.
