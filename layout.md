# Overall Layout

Sidebar on the right, topbar at the top, main content in the majority bottom right square.

## Sidebar

Navigational, with links to each of the main content pages.

Takes up the entire side of the page in wide view, collapses into a button in the narrow view, toggle button for it being located in the topbar.

### Mobile

see https://doc.rust-lang.org/book/ for inspiration on how to hide/show the sidebar on mobile.

## Topbar

### Items:

- Search bar
- move money dropdown
  - same actions as the home page's pill bar
- Notifications button
- User profile pic
  - on click opens dropdown to adjust preferences/access settings

### Mobile

Collapse search and move money dropdown into icons. Consider dropping bar into a bottom bar. Add an icon to open the sidebar to the right of the search bar. This makes 5 icons total.

## Main Content Pages

### Home

#### Tiles

- Transfer
  - Type in username/eth address first, infer network based on address
- day by day balance graph
- balance of each token the user owns
  - **Suggestion**: Maybe allow each account to be clicked on to show a graph of that individual token's balance over time?
- Money movement tiles:
  - Money In / Money Out. Top sources/spend
  - top identities transacted with based on USD volume.
- Recent transactions table
  - Same as transactions page

### Transactions

#### Table

- Columns: date, to/from, currency, USD value
  - maybe currencies? if we also display swaps as separate from transfers

#### Detail Popup

- Appears on click of transaction row
- Goes next to transactions table if there's room, otherwise slides in from right, dimming what is behind it.
- items in order from top to bottom:

  - Coin Identifier + Amount
  - Value in USD
  - transaction timeline

    - > For example in an unwrap, it might be confirmed on VSC within 1m, but take several more minutes to be processed on the Bitcoin mainnet. We can show this entire process to the end user upon request (it should not be the default). -Vaultec
    - Maybe something like this but vertically: `Sent 0.00001 BTC -> ... (Details) -> 🔄 @1A1z...vfNa` with a "Details" button to expand next to the `...`.
      - Expanded could be: `Sent 0.00001 BTC -> ✅ VSC Confirmation -> 🔄 BTC Mainnet -> 🔄 @1A1z...vfNa`

#### Filter Popup

- Filters:
  - Date (month selector)
  - method
  - status
  - amount
  - multi-select tokens
  - tag search

### Swap
