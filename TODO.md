# TODOs for Send BTC Mainnet

Ideally we have good notification support with local storage setup. That said,
if we rely purely on local storage to store user data then if that user switches
devices (or if the site's browser cache is cleared) then that other device will
have no clue about the off-chain transactions happening (ex. Boltz/V4V).

I think the best option is to store information in IndexedDB about those
initialized transactions and show them in the table as pending transactions 
(even if VSC hasn't seen them yet.) The downside of this approach is that users
who switch devices might fear that their transaction just vanished into thin
air.

Furthermore, since Boltz transactions take about 20 minutes to complete, 
we should give the user some way of checking in on the state of the transaction.
Again I think this should be done via IndexedDB + meshing with the transactions
page, but I'm open to other suggestions as well. 