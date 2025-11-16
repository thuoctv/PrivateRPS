# 🚀 Hướng Dẫn Deploy Contract Lên Sepolia Testnet

Hướng dẫn chi tiết từng bước để deploy contract RockPaperScissors lên Sepolia testnet.

## 📋 Mục Lục

1. [Chuẩn Bị](#chuẩn-bị)
2. [Cài Đặt Môi Trường](#cài-đặt-môi-trường)
3. [Lấy Sepolia ETH](#lấy-sepolia-eth)
4. [Cấu Hình Biến Môi Trường](#cấu-hình-biến-môi-trường)
5. [Compile Contract](#compile-contract)
6. [Deploy Contract](#deploy-contract)
7. [Verify Contract](#verify-contract)
8. [Cập Nhật Frontend](#cập-nhật-frontend)
9. [Kiểm Tra Deployment](#kiểm-tra-deployment)

---

## 1. Chuẩn Bị

### Yêu Cầu Hệ Thống

- ✅ **Node.js**: phiên bản 20 trở lên
- ✅ **npm**: phiên bản 7.0.0 trở lên
- ✅ **Git**: để quản lý version
- ✅ **Metamask**: ví Ethereum để kết nối với Sepolia

### Kiểm Tra Cài Đặt

```bash
# Kiểm tra Node.js
node --version
# Kết quả mong đợi: v20.x.x hoặc cao hơn

# Kiểm tra npm
npm --version
# Kết quả mong đợi: 7.0.0 hoặc cao hơn

# Kiểm tra Git
git --version
```

---

## 2. Cài Đặt Môi Trường

### Bước 2.1: Cài Đặt Dependencies

Đảm bảo bạn đã cài đặt tất cả dependencies của project:

```bash
# Di chuyển vào thư mục gốc của project
cd S:\zama\Rock-Paper-Scissors

# Cài đặt dependencies
npm install
```

**Lưu ý**: Nếu gặp lỗi, thử:
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

### Bước 2.2: Kiểm Tra Cấu Hình Hardhat

File `hardhat.config.ts` đã được cấu hình sẵn cho Sepolia. Bạn có thể kiểm tra:

- ✅ Network Sepolia đã được cấu hình (chainId: 11155111)
- ✅ Sử dụng Infura làm RPC provider
- ✅ Hỗ trợ cả PRIVATE_KEY và MNEMONIC

---

## 3. Lấy Sepolia ETH

Bạn cần Sepolia ETH để trả phí gas khi deploy. Có nhiều cách để lấy:

### Cách 1: Sepolia Faucet (Khuyên Dùng)

1. **Alchemy Sepolia Faucet**:
   - Truy cập: https://sepoliafaucet.com/
   - Nhập địa chỉ ví của bạn
   - Nhận 0.5 ETH Sepolia (miễn phí)

2. **Infura Sepolia Faucet**:
   - Truy cập: https://www.infura.io/faucet/sepolia
   - Đăng ký tài khoản miễn phí
   - Nhận Sepolia ETH

3. **Chainlink Faucet**:
   - Truy cập: https://faucets.chain.link/sepolia
   - Kết nối ví MetaMask
   - Nhận 0.1 ETH Sepolia

### Cách 2: Lấy Từ Ví Khác

Nếu bạn có Sepolia ETH trong ví khác, chuyển sang ví deploy.

### Kiểm Tra Số Dư

```bash
# Kiểm tra số dư trên Sepolia
# Sử dụng Etherscan: https://sepolia.etherscan.io/address/YOUR_ADDRESS
```

**Lưu ý**: Bạn cần ít nhất **0.01 ETH Sepolia** để deploy contract (thường tốn khoảng 0.001-0.005 ETH).

---

## 4. Cấu Hình Biến Môi Trường

Bạn có 2 cách để cấu hình: sử dụng file `.env` hoặc Hardhat vars.

### Cách 1: Sử Dụng File .env (Khuyên Dùng)

#### Bước 4.1: Tạo File .env

Tạo file `.env` trong thư mục gốc của project:

```bash
# Trong thư mục S:\zama\Rock-Paper-Scissors
touch .env
```

Hoặc tạo thủ công file `.env` với nội dung:

```env
# Private Key của ví deploy (bắt đầu với 0x hoặc không)
PRIVATE_KEY=your_private_key_here

# Hoặc sử dụng MNEMONIC (seed phrase)
MNEMONIC=your twelve word mnemonic phrase here

# Infura API Key (bắt buộc)
INFURA_API_KEY=your_infura_api_key_here

# Etherscan API Key (tùy chọn, để verify contract)
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

#### Bước 4.2: Lấy Private Key Từ MetaMask

1. Mở MetaMask
2. Click vào 3 chấm (menu) → **Account details**
3. Click **Export Private Key**
4. Nhập password của MetaMask
5. Copy private key (bắt đầu với `0x`)
6. Paste vào file `.env` sau `PRIVATE_KEY=`

**⚠️ CẢNH BÁO BẢO MẬT**:
- **KHÔNG BAO GIỜ** commit file `.env` lên Git
- **KHÔNG BAO GIỜ** chia sẻ private key với ai
- Chỉ sử dụng ví testnet, không dùng ví mainnet

#### Bước 4.3: Lấy Infura API Key

1. Truy cập: https://www.infura.io/
2. Đăng ký/Đăng nhập tài khoản
3. Tạo project mới:
   - Click **Create New Key**
   - Chọn **Web3 API**
   - Chọn network: **Sepolia**
   - Copy **API Key**
4. Paste vào file `.env` sau `INFURA_API_KEY=`

**Ví dụ**:
```env
INFURA_API_KEY=1234567890abcdef1234567890abcdef
```

#### Bước 4.4: Lấy Etherscan API Key (Tùy Chọn)

1. Truy cập: https://etherscan.io/
2. Đăng ký/Đăng nhập
3. Vào **API-KEYs**: https://etherscan.io/myapikey
4. Click **Add** để tạo API key mới
5. Copy API key
6. Paste vào file `.env` sau `ETHERSCAN_API_KEY=`

### Cách 2: Sử Dụng Hardhat Vars

Nếu không muốn dùng file `.env`, bạn có thể dùng Hardhat vars:

```bash
# Set mnemonic
npx hardhat vars set MNEMONIC

# Set Infura API key
npx hardhat vars set INFURA_API_KEY

# Set Etherscan API key (tùy chọn)
npx hardhat vars set ETHERSCAN_API_KEY
```

### Bước 4.5: Kiểm Tra Cấu Hình

Đảm bảo file `.env` có định dạng đúng:

```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
INFURA_API_KEY=your_infura_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
```

**Lưu ý**: 
- Nếu PRIVATE_KEY không bắt đầu với `0x`, Hardhat sẽ tự động thêm
- Bạn có thể dùng PRIVATE_KEY HOẶC MNEMONIC, không cần cả hai

---

## 5. Compile Contract

Trước khi deploy, bạn cần compile contract để đảm bảo không có lỗi:

```bash
# Compile contract
npm run compile
```

**Kết quả mong đợi**:
```
Compiled 1 Solidity file successfully
```

Nếu có lỗi, kiểm tra:
- ✅ Contract syntax đúng
- ✅ Import paths chính xác
- ✅ Solidity version tương thích

### Kiểm Tra Artifacts

Sau khi compile, kiểm tra artifacts đã được tạo:

```bash
# Kiểm tra file artifacts
ls artifacts/contracts/RockPaperScissors.sol/
```

Bạn sẽ thấy:
- `RockPaperScissors.json` - ABI và bytecode
- `RockPaperScissors.dbg.json` - Debug info

---

## 6. Deploy Contract

### Bước 6.1: Kiểm Tra Số Dư Ví

Đảm bảo ví deploy có đủ Sepolia ETH:

```bash
# Kiểm tra địa chỉ ví sẽ deploy
# Lấy từ PRIVATE_KEY hoặc MNEMONIC
```

### Bước 6.2: Deploy Contract

Sử dụng script deploy có sẵn:

```bash
# Deploy contract lên Sepolia
npm run deploy:sepolia
```

Hoặc sử dụng Hardhat trực tiếp:

```bash
npx hardhat deploy --network sepolia
```

**Kết quả mong đợi**:
```
deploying "RockPaperScissors" (tx: 0x...)
... deployed RockPaperScissors to 0x1234567890abcdef1234567890abcdef12345678
```

### Bước 6.3: Lưu Địa Chỉ Contract

**QUAN TRỌNG**: Copy địa chỉ contract được in ra. Bạn sẽ cần nó cho các bước sau.

Ví dụ:
```
RockPaperScissors contract: 0x535D55BE3138B4E8000EcCa973ac044d736e55D6
```

### Bước 6.4: Kiểm Tra Transaction

1. Mở Sepolia Etherscan: https://sepolia.etherscan.io/
2. Tìm transaction hash từ output deploy
3. Xác nhận transaction đã thành công

---

## 7. Verify Contract (Tùy Chọn Nhưng Khuyên Dùng)

Verify contract trên Etherscan giúp người dùng có thể đọc code và tương tác dễ dàng hơn.

### Bước 7.1: Verify Contract

```bash
# Verify contract trên Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

**Ví dụ**:
```bash
npx hardhat verify --network sepolia 0x535D55BE3138B4E8000EcCa973ac044d736e55D6
```

**Kết quả mong đợi**:
```
Successfully verified contract RockPaperScissors on Etherscan.
https://sepolia.etherscan.io/address/0x535D55BE3138B4E8000EcCa973ac044d736e55D6#code
```

### Bước 7.2: Kiểm Tra Verification

1. Truy cập link Etherscan được cung cấp
2. Tab **Contract** sẽ hiển thị code đã được verify
3. Tab **Read Contract** và **Write Contract** sẽ hoạt động

---

## 8. Cập Nhật Frontend

Sau khi deploy, bạn cần cập nhật địa chỉ contract trong frontend.

### Bước 8.1: Cập Nhật Contract Address

Mở file `game/src/config/contracts.ts` và cập nhật:

```typescript
// Thay đổi địa chỉ contract
export const CONTRACT_ADDRESS = '0x535D55BE3138B4E8000EcCa973ac044d736e55D6'; // Địa chỉ mới của bạn
```

### Bước 8.2: Cập Nhật ABI (Nếu Cần)

Nếu contract có thay đổi, copy ABI mới từ artifacts:

```bash
# Copy ABI từ artifacts
cat artifacts/contracts/RockPaperScissors.sol/RockPaperScissors.json | jq .abi
```

Paste vào file `contracts.ts` trong phần `CONTRACT_ABI`.

### Bước 8.3: Kiểm Tra Frontend

```bash
# Di chuyển vào thư mục game
cd game

# Cài đặt dependencies (nếu chưa)
npm install

# Chạy dev server
npm run dev
```

---

## 9. Kiểm Tra Deployment

### Bước 9.1: Kiểm Tra Trên Etherscan

1. Truy cập: https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
2. Kiểm tra:
   - ✅ Contract đã được deploy
   - ✅ Code đã được verify (nếu đã verify)
   - ✅ Contract có thể đọc/ghi

### Bước 9.2: Test Contract Functions

Bạn có thể test contract bằng Hardhat console:

```bash
# Mở Hardhat console với network Sepolia
npx hardhat console --network sepolia
```

Trong console:

```javascript
// Lấy contract instance
const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
const rps = await RockPaperScissors.attach("YOUR_CONTRACT_ADDRESS");

// Kiểm tra gameCounter
const counter = await rps.gameCounter();
console.log("Game Counter:", counter.toString());

// Kiểm tra các functions khác
// ...
```

### Bước 9.3: Test Từ Frontend

1. Kết nối MetaMask với Sepolia network
2. Mở frontend: http://localhost:5173 (hoặc port khác)
3. Thử tạo game mới
4. Kiểm tra transaction trên Etherscan

---

## 🔧 Xử Lý Lỗi Thường Gặp

### Lỗi 1: "Insufficient funds"

**Nguyên nhân**: Ví không đủ Sepolia ETH

**Giải pháp**:
- Lấy thêm Sepolia ETH từ faucet
- Kiểm tra số dư: https://sepolia.etherscan.io/address/YOUR_ADDRESS

### Lỗi 2: "Invalid API key"

**Nguyên nhân**: INFURA_API_KEY không đúng

**Giải pháp**:
- Kiểm tra lại API key trong file `.env`
- Đảm bảo API key có quyền truy cập Sepolia network

### Lỗi 3: "Nonce too high"

**Nguyên nhân**: Nonce không khớp

**Giải pháp**:
```bash
# Reset nonce (nếu cần)
# Hoặc đợi một chút rồi thử lại
```

### Lỗi 4: "Contract verification failed"

**Nguyên nhân**: Thông tin verify không khớp

**Giải pháp**:
- Đảm bảo đã compile với cùng settings
- Kiểm tra constructor arguments (nếu có)
- Thử verify lại sau vài phút

### Lỗi 5: "Network error"

**Nguyên nhân**: Kết nối RPC bị lỗi

**Giải pháp**:
- Kiểm tra kết nối internet
- Thử lại sau vài phút
- Kiểm tra Infura status: https://status.infura.io/

---

## 📝 Checklist Deployment

Trước khi deploy, đảm bảo:

- [ ] Đã cài đặt tất cả dependencies (`npm install`)
- [ ] Đã tạo file `.env` với các biến cần thiết
- [ ] Đã có Sepolia ETH trong ví (ít nhất 0.01 ETH)
- [ ] Đã compile contract thành công (`npm run compile`)
- [ ] Đã kiểm tra contract không có lỗi
- [ ] Đã backup private key an toàn
- [ ] Đã kiểm tra network là Sepolia (chainId: 11155111)

Sau khi deploy:

- [ ] Đã lưu địa chỉ contract
- [ ] Đã verify contract trên Etherscan
- [ ] Đã cập nhật địa chỉ contract trong frontend
- [ ] Đã test contract từ frontend
- [ ] Đã kiểm tra transaction trên Etherscan

---

## 🎯 Tóm Tắt Các Lệnh Quan Trọng

```bash
# 1. Cài đặt dependencies
npm install

# 2. Compile contract
npm run compile

# 3. Deploy lên Sepolia
npm run deploy:sepolia

# 4. Verify contract
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# 5. Test contract
npm run test:sepolia
```

---

## 📚 Tài Liệu Tham Khảo

- **Sepolia Testnet**: https://sepolia.dev/
- **Etherscan Sepolia**: https://sepolia.etherscan.io/
- **Infura**: https://www.infura.io/
- **Hardhat Docs**: https://hardhat.org/docs
- **Zama FHEVM Docs**: https://docs.zama.ai/fhevm

---

## 🆘 Cần Hỗ Trợ?

Nếu gặp vấn đề:

1. Kiểm tra lại các bước trong hướng dẫn
2. Xem phần "Xử Lý Lỗi Thường Gặp"
3. Kiểm tra logs chi tiết khi chạy lệnh
4. Tham khảo tài liệu Hardhat và Zama

---

**Chúc bạn deploy thành công! 🚀**

