// We are going to skimp a bit on these tests...

const { assert, expect } = require("chai")
const { network, deployments, ethers, waffle } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random IPFS NFT Unit Tests", function () {
          let randomIpfsNft, deployer, vrfCoordinatorV2Mock
          const chainId = network.config.chainId
          const mintFee = networkConfig[chainId]["mintFee"]

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              await deployments.fixture(["mocks", "randomipfs"])
              randomIpfsNft = await ethers.getContract("RandomIpfsNft")
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock"
              )
          })

          describe("constructor", () => {
              it("sets starting values correctly", async function () {
                  const dogTokenUriZero = await randomIpfsNft.getDogTokenUris(0)
                  //const isInitialized = await randomIpfsNft.getInitialized()
                  const contractMintFee = await randomIpfsNft.getMintFee()
                  assert(dogTokenUriZero.includes("ipfs://"))
                  //assert.equal(isInitialized, true)
                  assert.equal(contractMintFee.toString(), mintFee.toString())
              })
          })

          describe("requestNft", () => {
              it("fails if payment isn't sent with the request", async function () {
                  await expect(randomIpfsNft.requestNft()).to.be.revertedWith(
                      "RandomIpfsNft__NeedMoreETHSent"
                  )
              })
              it("reverts if payment amount is less than the mint fee", async function () {
                  const fee = await randomIpfsNft.getMintFee()
                  const bigNumberMintFee = ethers.BigNumber.from(
                      mintFee.toString()
                  )
                  await expect(
                      randomIpfsNft.requestNft({
                          value: bigNumberMintFee.sub(
                              ethers.utils.parseEther("0.001")
                          ),
                      })
                  ).to.be.revertedWith("RandomIpfsNft__NeedMoreETHSent")
              })
              it("emits an event and kicks off a random word request", async function () {
                  const fee = await randomIpfsNft.getMintFee()
                  await expect(
                      randomIpfsNft.requestNft({ value: fee.toString() })
                  ).to.emit(randomIpfsNft, "NftRequested")
              })
          })
          describe("fulfillRandomWords", () => {
              it("mints NFT after random number is returned", async function () {
                  await new Promise(async (resolve, reject) => {
                      randomIpfsNft.once("NftMinted", async () => {
                          try {
                              const tokenUri = await randomIpfsNft.tokenURI("0")
                              const tokenCounter =
                                  await randomIpfsNft.getTokenCounter()
                              assert.equal(
                                  tokenUri.toString().includes("ipfs://"),
                                  true
                              )
                              assert.equal(tokenCounter.toString(), "1")
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      try {
                          const fee = await randomIpfsNft.getMintFee()
                          const requestNftResponse =
                              await randomIpfsNft.requestNft({
                                  value: fee.toString(),
                              })
                          const requestNftReceipt =
                              await requestNftResponse.wait(1)
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              requestNftReceipt.events[1].args.requestId,
                              randomIpfsNft.address
                          )
                      } catch (e) {
                          console.log(e)
                          reject(e)
                      }
                  })
              })
          })
          describe("getBreedFromModdedRng", () => {
              it("should return pug if moddedRng < 10", async function () {
                  const expectedValue =
                      await randomIpfsNft.getBreedFromModdedRng(7)
                  assert.equal(0, expectedValue)
              })
              it("should return shiba-inu if moddedRng is between 10 - 39", async function () {
                  const expectedValue =
                      await randomIpfsNft.getBreedFromModdedRng(21)
                  assert.equal(1, expectedValue)
              })
              it("should return st. bernard if moddedRng is between 40 - 99", async function () {
                  const expectedValue =
                      await randomIpfsNft.getBreedFromModdedRng(77)
                  assert.equal(2, expectedValue)
              })
              it("should revert if moddedRng > 99", async function () {
                  await expect(
                      randomIpfsNft.getBreedFromModdedRng(100)
                  ).to.be.revertedWith("RangeOutOfBounds")
              })
          })
          describe("withdraw", () => {
              it("should withdraw entire balance", async function () {
                  await new Promise(async (resolve, reject) => {
                      randomIpfsNft.once("NftMinted", async () => {
                          try {
                              await randomIpfsNft.withdraw()
                              const provider = waffle.provider
                              const balance = await provider.getBalance(
                                  randomIpfsNft.address
                              )
                              assert.equal(balance.toString(), "0")
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      try {
                          const fee = await randomIpfsNft.getMintFee()
                          const requestNftResponse =
                              await randomIpfsNft.requestNft({
                                  value: fee.toString(),
                              })
                          const requestNftReceipt =
                              await requestNftResponse.wait(1)
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              requestNftReceipt.events[1].args.requestId,
                              randomIpfsNft.address
                          )
                      } catch (e) {
                          console.log(e)
                          reject(e)
                      }
                  })
              })
              it("should revert if called by non-owner", async function () {
                  accounts = await ethers.getSigners()
                  impostor = accounts[1]
                  const randomIpfsNftConnectedContract =
                      randomIpfsNft.connect(impostor)
                  await expect(
                      randomIpfsNftConnectedContract.withdraw()
                  ).to.be.revertedWith("Ownable: caller is not the owner")
              })
          })
          describe("getters", () => {
              it("should get chance array", async function () {
                  const chanceArray = await randomIpfsNft.getChanceArray()
                  assert.equal(chanceArray[0].toString(), "10")
                  assert.equal(chanceArray[1].toString(), "30")
                  assert.equal(chanceArray[2].toString(), "100")
              })
              it("should get mint fee", async function () {
                  const receivedMintFee = await randomIpfsNft.getMintFee()
                  assert.equal(receivedMintFee.toString(), mintFee.toString())
              })
              it("should get dog token URIs", async function () {
                  let tokenUris = [
                      "ipfs://QmNddFsneWThscVTyaTPWoiYAe5X462TSq27Bg2NX6HeWh",
                      "ipfs://QmNqYUNjjRDXU4KN1cLA5pUgJ3V4cEVR7VWwDtCh8Awwue",
                      "ipfs://Qme7UtrSEuizrnR2wjf2wCmh7YradDvsFicn5ozMrxzc6M",
                  ]
                  let uri
                  for (let i = 0; i < 3; i++) {
                      uri = await randomIpfsNft.getDogTokenUris(i)
                      assert.equal(uri.toString(), tokenUris[i].toString())
                  }
              })
              it("should get token counter", async function () {
                  const tokenCounter = await randomIpfsNft.getTokenCounter()
                  assert.equal(tokenCounter.toString(), "0")
              })
          })
      })
