# CLEAN RUSH — 共栄美装様向け収集ゲーム

瀬野川産業版の3D迷路・スマホ操作を生かした独立した提案用デモ。住宅街・商店街・オフィスの3地点を回収し、60秒以内にセンターへ向かいます。架空の街・ゲームルールであり、実際の収集ルートや作業手順を再現するものではありません。

公開URL： https://kyouei-clean-rush.sekai1977.chatgpt.site

編集用ソース： https://github.com/sekai1977/kyouei-clean-rush （公開リポジトリ）

2026年10月1日公開。ChatGPTへのログインなしで遊べます。スマホやPCのブラウザーから、このURLを開いてください。

## 遊び方

俯瞰で全体を確認し「回収スタート」。出発後はトラックへ拡大します。パッドを押し続けて走り、滑らせて曲がり、離すと次の交差点で止まります。道路上の矢印タップでも移動できます。全体図では道路をなぞってルート指定。回収ポイントに到着すると0.8秒停車して自動で積み込み、ごみが片付きます。3地点を回収したらセンターへ。

## 制作・起動

Node.js 22.13以上が必要です。

```sh
git clone https://github.com/sekai1977/kyouei-clean-rush.git
cd kyouei-clean-rush
npm ci
npm run dev -- --port 8158
```

表示されたLocal URLを開きます。`npm run build` で公開用データを作成します。

操作・迷路の確認：

```sh
node --test tests/drive-controls.test.mjs tests/maze-world.test.mjs
```

ゲームはSitesで公開しています。GitHubへの保存だけでは、公開ゲームは更新されません。元の瀬野川産業版は別作品として保持しています。

## 公式情報

- 公式サイト：https://kyoueibisou.jp/
- 採用情報：https://kyoueibisou.jp/recruit/
- 会社・車両情報：https://kyoueibisou.jp/company/

2026年10月1日に確認。収集車・街は提案用のオリジナル3D表現で、実際の車両の忠実な再現ではありません。結果画面から公式の採用情報へ進めます。成績を送信する機能はありません。
